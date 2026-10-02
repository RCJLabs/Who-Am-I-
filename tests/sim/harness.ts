// Drives simulated respondents through the real flow engine, exactly as the app would.
import type { AnswerEvent, Response, TensionResolution } from '../../src/model/answers.ts';
import type { Bundle, Item, TopicId } from '../../src/model/content.ts';
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
  s: AnswerState;
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

export function runRespondent(bundle: Bundle, policy: Policy, opts: RunOptions = {}): RunResult {
  const rng = mulberry32(opts.seed ?? 1);
  const events: AnswerEvent[] = [];
  const resolutions: TensionResolution[] = [];
  const transcript: TranscriptEntry[] = [];
  let n = 0;
  const nextId = () => `s${String(++n).padStart(7, '0')}`;
  const topics = opts.topics ?? bundle.topics.map((t) => t.id);

  for (const topicId of topics) {
    const topic = bundle.topics.find((t) => t.id === topicId);
    if (!topic) throw new Error(`unknown topic ${topicId}`);
    const limit = 2 * topic.items.length + 10;
    let steps = 0;
    let tensionShown = false;
    for (;;) {
      const s = buildAnswerState(bundle, events);
      const source = !tensionShown && opts.tensions ? opts.tensions(s, resolutions) : null;
      const step = nextStep(s, topicId, { alwaysDeep: opts.alwaysDeep ?? false, tensions: source?.candidates ?? [] });
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
      const r = policy({ step, item: step.item, s, rng, bundle });
      const ev: AnswerEvent = { id: nextId(), item: step.item.id, r, at: n, cv: bundle.contentVersion };
      if (step.kind === 'reask') ev.via = step.via;
      events.push(ev);
      const entry: TranscriptEntry = { topic: topicId, kind: step.kind, item: step.item.id, r };
      if (step.kind === 'reask' && 'source' in step.via) entry.via = step.via.source;
      transcript.push(entry);
    }
  }
  return { events, resolutions, transcript, state: buildAnswerState(bundle, events) };
}
