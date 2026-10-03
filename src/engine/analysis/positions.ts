// The user's firmest current positions: far from the middle of the scale, and important to them.
import type { Profile } from '../../model/profile.ts';
import { importance01 } from '../flow.ts';
import type { AnswerState } from '../state.ts';
import { FIRM_POSITION, LIMIT } from './constants.ts';
import type { PositionFact } from './types.ts';

/**
 * Topics in the profile's scope whose stance has a current value at least FIRM_POSITION from the
 * middle, ranked by |value| × importance (0.5 when unanswered); ties keep content order. A stance
 * last answered "not sure" or skipped has no current value, so it isn't a position.
 */
export function firmPositions(s: AnswerState, profile: Profile, n: number = LIMIT.positions): PositionFact[] {
  const out: PositionFact[] = [];
  for (const t of s.ix.bundle.topics) {
    if (!t.stance || !(t.id in profile.topics)) continue;
    const r = s.values.get(t.stance);
    if (!r || r.kind !== 'scale' || Math.abs(r.v) < FIRM_POSITION) continue;
    out.push({ topic: t.id, value: r.v, importance: importance01(s, t) });
  }
  const rank = (p: PositionFact) => Math.abs(p.value) * (p.importance ?? 0.5);
  return out.sort((a, b) => rank(b) - rank(a)).slice(0, n);
}
