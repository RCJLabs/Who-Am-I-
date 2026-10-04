// Links from research: published associations between a personality trait and an interest, shown
// only where the person's own answers clearly lean one way. A trait counts only with all its items
// answered, at least 0.5 toward a pole on its own scale, and at least half a standard deviation
// beyond the published adult mean in the same direction (norms only gate; nothing compares the
// person with anyone). Agreeing with both items of a reversal pair voids a trait. Each link shows
// the end the answers lean to: the one with more interest, or the other, where the same activity
// plays a small part. One per kind, the clearest lean first; ties go to authored order.
import type { AnalysisPack } from '../../model/analysis.ts';
import type { AxisId, ItemId } from '../../model/content.ts';
import type { Profile } from '../../model/profile.ts';
import { numericValue } from '../normalize.ts';
import type { AnswerState } from '../state.ts';
import { LIMIT, SUGGEST } from './constants.ts';
import type { SuggestionRec } from './types.ts';

export function suggestionsFor(pack: AnalysisPack, profile: Pick<Profile, 'axes'>, s: Pick<AnswerState, 'values'>, n: number = LIMIT.suggestions): SuggestionRec[] {
  const agrees = (id: ItemId): boolean => {
    const r = s.values.get(id);
    const v = r ? numericValue(r) : undefined;
    return v !== undefined && v >= 0.5 - 1e-9;
  };
  const leaning = new Map<AxisId, { pole: 0 | 1; margin: number }>();
  for (const [trait, norm] of Object.entries(pack.norms)) {
    const a = profile.axes[trait];
    if (!a || a.score === null || a.confidence < SUGGEST.confidence - 1e-9) continue;
    if (norm.reversals.some(([x, y]) => agrees(x) && agrees(y))) continue;
    const pole = a.score > 0 ? 1 : 0;
    const dir = pole ? 1 : -1;
    const beyond = (dir * (a.score - norm.mean)) / norm.sd;
    if (dir * a.score < SUGGEST.lean - 1e-9 || beyond < SUGGEST.beyondMean - 1e-9) continue;
    leaning.set(trait, { pole, margin: Math.round(beyond * 1e4) / 1e4 });
  }
  const best = new Map<string, { rec: SuggestionRec; margin: number; order: number }>();
  pack.suggestions.forEach((g, order) => {
    const lean = leaning.get(g.trait);
    if (!lean) return;
    const held = best.get(g.kind);
    if (held && held.margin >= lean.margin) return;
    const rec: SuggestionRec = { kind: 'suggestion', suggestion: g.id, about: g.kind, end: lean.pole === g.toward ? 'toward' : 'away', basis: [{ axis: g.trait, pole: lean.pole }] };
    best.set(g.kind, { rec, margin: lean.margin, order });
  });
  return [...best.values()]
    .sort((a, b) => b.margin - a.margin || a.order - b.order)
    .slice(0, n)
    .map((x) => x.rec);
}
