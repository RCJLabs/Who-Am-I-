// Drives simulated respondents through the real flow engine, exactly as the app would.
import type { AnswerEvent, Response, TensionResolution } from '../../src/model/answers.ts';
import type { Bundle, Item, Topic, TopicId } from '../../src/model/content.ts';
import { condRefs } from '../../src/engine/cond/parse.ts';
import { nextStep, type Step, type TensionCandidate } from '../../src/engine/flow.ts';
import { mulberry32 } from '../../src/engine/rng.ts';
import { buildAnswerState, type AnswerState } from '../../src/engine/state.ts';
import { openTensions } from '../../src/engine/tensions.ts';

/** The real tension detector, as the app wires it. */
export const engineTensions: TensionSource = (s, resolutions) => {
  const open = openTensions(s, resolutions);
  return {
    candidates: open.map((t) => ({ key: t.key, topics: [t.a.topic, t.b.topic] as const, rank: t.rank })),
    basis: (key) => open.find((t) => t.key === key)?.basis ?? [],
  };
};

export type AskStep = Extract<Step, { kind: 'item' | 'reask' }>;

export interface PolicyCtx {
  step: AskStep;
  item: Item;
  /** The full answer state before this answer (built on first access). */
  readonly s: AnswerState;
  rng: () => number;
  bundle: Bundle;
}

export type Policy = (ctx: PolicyCtx) => Response;

/** Decides how a respondent resolves a tension card: null = dismiss ("not now"). */
export type TensionPolicy = (ctx: { key: string; s: AnswerState; rng: () => number }) => Omit<TensionResolution, 'id' | 'at' | 'key' | 'basis'> | null;

/** Supplies open tensions for the flow (wired to the tension detector by callers). */
export type TensionSource = (s: AnswerState, resolutions: readonly TensionResolution[]) => { candidates: TensionCandidate[]; basis: (key: string) => string[] };

export interface RunOptions {
  topics?: TopicId[];
  seed?: number;
  alwaysDeep?: boolean;
  tensions?: TensionSource;
  tensionPolicy?: TensionPolicy;
  /**
   * Rebuild the whole answer state and ask for tensions at every step, as the app's stores do.
   * Much slower; the default path must give identical runs (a sim test checks this).
   */
  reference?: boolean;
}

export interface TranscriptEntry {
  topic: TopicId;
  kind: 'item' | 'reask' | 'tension';
  item?: string;
  via?: string;
  r?: Response;
  tension?: string;
}

export interface RunResult {
  events: AnswerEvent[];
  resolutions: TensionResolution[];
  transcript: TranscriptEntry[];
  state: AnswerState;
}

// A topic's flow (visibility, gating, re-asks, revisions) depends only on its own items unless a
// condition refers to another topic, which the compiler allows with a warning (W102).
function selfContained(topic: Topic): boolean {
  const own = new Set(topic.items.map((i) => i.id));
  return topic.items.every((i) => condRefs(i.when).every((ref) => own.has(ref)));
}

// One bundle per topic, cached so the bundle index (a WeakMap keyed by bundle) is built once.
const topicBundles = new WeakMap<Bundle, Map<TopicId, Bundle>>();
function topicBundle(bundle: Bundle, topic: Topic): Bundle {
  let byTopic = topicBundles.get(bundle);
  if (!byTopic) topicBundles.set(bundle, (byTopic = new Map()));
  let tb = byTopic.get(topic.id);
  if (!tb) byTopic.set(topic.id, (tb = { ...bundle, topics: [topic] }));
  return tb;
}

/**
 * Runs one respondent through the given topics in order. By default each step builds the flow
 * state from the current topic's events only, with the real state builder, and asks for tensions
 * only once the topic has nothing left to ask: rebuilding everything at every step made long
 * simulations grow with the square of the bank's size. `reference: true` runs the original
 * full-rebuild loop.
 */
export function runRespondent(bundle: Bundle, policy: Policy, opts: RunOptions = {}): RunResult {
  const rng = mulberry32(opts.seed ?? 1);
  const events: AnswerEvent[] = [];
  const resolutions: TensionResolution[] = [];
  const transcript: TranscriptEntry[] = [];
  let n = 0;
  const nextId = () => `s${String(++n).padStart(7, '0')}`;
  const topics = opts.topics ?? bundle.topics.map((t) => t.id);
  const alwaysDeep = opts.alwaysDeep ?? false;
  const fullState = () => buildAnswerState(bundle, events);

  for (const topicId of topics) {
    const topic = bundle.topics.find((t) => t.id === topicId);
    if (!topic) throw new Error(`unknown topic ${topicId}`);
    const scoped = !opts.reference && selfContained(topic) ? topicBundle(bundle, topic) : null;
    const own: AnswerEvent[] = [];
    const limit = 2 * topic.items.length + 10;
    let steps = 0;
    let tensionShown = false;
    for (;;) {
      let s: AnswerState;
      let source: ReturnType<TensionSource> | null = null;
      let step: Step;
      if (opts.reference) {
        s = fullState();
        source = !tensionShown && opts.tensions ? opts.tensions(s, resolutions) : null;
        step = nextStep(s, topicId, { alwaysDeep, tensions: source?.candidates ?? [] });
      } else {
        s = scoped ? buildAnswerState(scoped, own) : fullState();
        step = nextStep(s, topicId, { alwaysDeep, tensions: [] });
        // nextStep only looks at tensions once the topic's items are exhausted.
        if (step.kind === 'done' && !tensionShown && opts.tensions) {
          s = scoped ? fullState() : s;
          source = opts.tensions(s, resolutions);
          step = nextStep(s, topicId, { alwaysDeep, tensions: source.candidates });
        }
      }
      if (step.kind === 'done') break;
      if (++steps > limit) throw new Error(`flow did not terminate in ${topicId} after ${limit} steps`);
      if (step.kind === 'tension') {
        tensionShown = true;
        transcript.push({ topic: topicId, kind: 'tension', tension: step.key });
        const decision = opts.tensionPolicy?.({ key: step.key, s, rng }) ?? null;
        if (decision) {
          const id = nextId();
          resolutions.push({ ...decision, id, at: n, key: step.key, basis: source!.basis(step.key) });
        }
        continue;
      }
      let full: AnswerState | undefined;
      const r = policy({
        step,
        item: step.item,
        get s() {
          return (full ??= fullState());
        },
        rng,
        bundle,
      });
      const ev: AnswerEvent = { id: nextId(), item: step.item.id, r, at: n, cv: bundle.contentVersion };
      if (step.kind === 'reask') ev.via = step.via;
      events.push(ev);
      own.push(ev);
      const entry: TranscriptEntry = { topic: topicId, kind: step.kind, item: step.item.id, r };
      if (step.kind === 'reask' && 'source' in step.via) entry.via = step.via.source;
      transcript.push(entry);
    }
  }
  return { events, resolutions, transcript, state: fullState() };
}
