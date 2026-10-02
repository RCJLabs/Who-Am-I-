// What to ask next. Stateless: everything is derived from the answer log, so revisions,
// resuming, content updates and multiple tabs are handled without a stored cursor.
import type { AnswerEvent, Via } from '../model/answers.ts';
import type { ChallengeItem, Item, ReaskItem, Topic, TopicId } from '../model/content.ts';
import { evalCond } from './cond/eval.ts';
import type { AnswerState } from './state.ts';

export type Step =
  | { kind: 'item'; item: Item }
  | { kind: 'reask'; item: Item; via: Via; previous: AnswerEvent | undefined }
  | { kind: 'tension'; key: string }
  | { kind: 'done' };

/** A tension the flow may offer at the end of a topic (already filtered for this session). */
export interface TensionCandidate {
  key: string;
  topics: readonly [TopicId, TopicId];
  rank: number;
}

export interface FlowOptions {
  /** Ask deep items regardless of importance. */
  alwaysDeep?: boolean;
  tensions?: readonly TensionCandidate[];
}

export function nextStep(s: AnswerState, topicId: TopicId, o: FlowOptions = {}): Step {
  const topic = s.ix.topics.get(topicId);
  if (!topic) return { kind: 'done' };

  const pending = pendingRevise(s, topic);
  if (pending) {
    return { kind: 'reask', item: pending.target, via: { kind: 'challenge', source: pending.challenge.id }, previous: s.latest.get(pending.target.id) };
  }

  for (const item of topic.items) {
    if (!s.visible.get(item.id)) continue;
    if (item.type === 'reask') {
      if (reaskDue(s, item)) {
        const target = s.ix.items.get(item.target)!;
        return { kind: 'reask', item: target, via: { kind: 'reask', source: item.id }, previous: s.latest.get(target.id) };
      }
      continue;
    }
    if (s.latest.has(item.id) || isGated(s, item, o)) continue;
    return { kind: 'item', item };
  }

  let best: TensionCandidate | undefined;
  for (const t of o.tensions ?? []) {
    if (t.topics.includes(topicId) && (!best || t.rank > best.rank)) best = t;
  }
  return best ? { kind: 'tension', key: best.key } : { kind: 'done' };
}

/**
 * A challenge answered with a `revise` option re-asks its target immediately. It stays pending
 * until the target is answered again by any route.
 */
export function pendingRevise(s: AnswerState, topic: Topic): { challenge: ChallengeItem; target: Item } | null {
  let found: { challenge: ChallengeItem; target: Item; at: string } | null = null;
  for (const item of topic.items) {
    if (item.type !== 'challenge') continue;
    const ev = s.latest.get(item.id);
    if (!ev || ev.r.kind !== 'option') continue;
    const chosen = ev.r.option;
    const revise = item.options.find((o) => o.id === chosen)?.revise;
    if (!revise || s.visible.get(revise) !== true) continue;
    const targetLatest = s.latest.get(revise);
    if (targetLatest && targetLatest.id > ev.id) continue;
    if (!found || ev.id < found.at) found = { challenge: item, target: s.ix.items.get(revise)!, at: ev.id };
  }
  return found && { challenge: found.challenge, target: found.target };
}

/** A reask is due when a challenge aimed at its target was answered after the target's latest answer. */
export function reaskDue(s: AnswerState, r: ReaskItem): boolean {
  if (!s.values.has(r.target)) return false;
  const last = s.latest.get(r.target)!.id;
  const topic = s.ix.topicOf.get(r.id)!;
  return topic.items.some((c) => {
    if (c.type !== 'challenge' || c.targets !== r.target) return false;
    const ev = s.latest.get(c.id);
    return ev !== undefined && ev.r.kind === 'option' && ev.id > last;
  });
}

/** The topic's importance as 0..1, or null if unanswered. */
export function importance01(s: AnswerState, topic: Topic): number | null {
  if (!topic.importance) return null;
  const r = s.values.get(topic.importance);
  return r && r.kind === 'scale' ? (r.v + 1) / 2 : null;
}

/** Deep items are skipped when the user said the topic matters little to them. */
export function isGated(s: AnswerState, item: Item, o: FlowOptions = {}): boolean {
  if (!item.deep || o.alwaysDeep) return false;
  const imp = importance01(s, s.ix.topicOf.get(item.id)!);
  return imp !== null && imp < s.ix.bundle.config.deepMinImportance;
}

export interface Progress {
  answered: number;
  /** Items that are or may still become visible and haven't been asked. */
  remaining: number;
  complete: boolean;
}

export function progress(s: AnswerState, topicId: TopicId, o: FlowOptions = {}): Progress {
  const topic = s.ix.topics.get(topicId);
  if (!topic) return { answered: 0, remaining: 0, complete: true };
  // Same lookup as visibility: live values within the topic, raw values across topics.
  const lookup = (ref: string) => (s.ix.topicOf.get(ref) === topic ? s.live.get(ref) : s.values.get(ref));
  let answered = 0;
  let remaining = 0;
  for (const item of topic.items) {
    if (item.type === 'reask' || isGated(s, item, o)) continue;
    if (s.latest.has(item.id)) {
      if (s.visible.get(item.id)) answered++;
    } else if (evalCond(item.when, lookup) !== false) {
      remaining++;
    }
  }
  const complete = nextStep(s, topicId, { ...o, tensions: [] }).kind === 'done';
  return { answered, remaining: complete ? 0 : remaining, complete };
}
