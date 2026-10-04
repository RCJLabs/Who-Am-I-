// Reading from both sides, from the cited challenges already in the content: on each firm
// position, the cases aimed at the user's side (against) and the cases put to people on the
// other side (for). Authored challenges are aimed by `when` on the stance, so mirroring the
// stance finds the other side's cases.
import type { ChallengeItem, Topic } from '../../model/content.ts';
import { isScale, scalePoints } from '../../model/content.ts';
import { evalCond } from '../cond/eval.ts';
import { isGated, type FlowOptions } from '../flow.ts';
import type { Resolved } from '../normalize.ts';
import { itemHistory } from '../shifts.ts';
import type { AnswerState } from '../state.ts';
import { LIMIT } from './constants.ts';
import type { CaseRec, Met, PositionFact } from './types.ts';

/** Challenges citing a real source (not "Original scenario"). */
export function citable(source: string | undefined): boolean {
  return !!source && !/^original scenario/i.test(source.trim());
}

/** How the user met a challenge, or null if it hasn't been answered. */
export function met(s: AnswerState, ch: ChallengeItem): Met {
  const r = s.values.get(ch.id);
  if (!r || r.kind !== 'option') return null;
  if (itemHistory(s, ch.targets).moves.some((m) => m.via === 'challenge' && m.source === ch.id && m.delta !== 0)) return 'moved';
  return ch.options.find((o) => o.id === r.option)?.reaction === 'distinguish' ? 'distinguished' : 'held';
}

export function casesFor(s: AnswerState, positions: readonly PositionFact[], o: FlowOptions = {}): CaseRec[] {
  const out: CaseRec[] = [];
  for (const p of positions) {
    const topic = s.ix.topics.get(p.topic);
    if (!topic?.stance) continue;
    const stance = topic.stance;
    const challenges = topic.items.filter((it): it is ChallengeItem => it.type === 'challenge' && it.targets === stance && citable(it.source) && !it.sensitive);
    const against = challenges.filter((c) => s.visible.get(c.id) === true && (s.values.has(c.id) || !isGated(s, c, o)));
    const mirrored = mirrorLookup(s, topic);
    const forCases = challenges.filter((c) => s.visible.get(c.id) !== true && evalCond(c.when, mirrored) === true);
    for (const c of against.slice(0, LIMIT.against)) out.push({ kind: 'case', side: 'against', topic: topic.id, challenge: c.id, met: met(s, c) });
    for (const c of forCases.slice(0, LIMIT.for)) out.push({ kind: 'case', side: 'for', topic: topic.id, challenge: c.id, met: null });
  }
  return out;
}

/** The visibility lookup with the topic's stance reflected to the other side of the scale. */
function mirrorLookup(s: AnswerState, topic: Topic): (ref: string) => Resolved | undefined {
  const stance = topic.stance!;
  const item = s.ix.items.get(stance);
  const r = s.live.get(stance);
  const flipped: Resolved | undefined = item && isScale(item) && r?.kind === 'scale' ? { kind: 'scale', v: -r.v, step: scalePoints(item) + 1 - r.step } : undefined;
  return (ref) => {
    if (ref === stance) return flipped;
    return s.ix.topicOf.get(ref) === topic ? s.live.get(ref) : s.values.get(ref);
  };
}
