// Personal suggestions: the pack's rules read against how the person described themselves, in the
// public profile only. A spectrum counts only when it's scored with enough evidence, so a rule
// never fires on a guess. The answers must clear every threshold in a rule; the suggestion each
// kind shows is the one they clear by the widest margin (authored order breaks ties), and the
// clearest kinds come first.
import type { AnalysisPack, Suggestion } from '../../model/analysis.ts';
import type { Cond } from '../../model/content.ts';
import type { Profile } from '../../model/profile.ts';
import { evalCond } from '../cond/eval.ts';
import { LIMIT, SUGGEST } from './constants.ts';
import type { SuggestionRec } from './types.ts';

export function suggestionsFor(pack: AnalysisPack, profile: Pick<Profile, 'axes'>, n: number = LIMIT.suggestions): SuggestionRec[] {
  const score = (axis: string): number | undefined => {
    const a = profile.axes[axis];
    return a && a.score !== null && a.confidence >= SUGGEST.confidence - 1e-9 ? a.score : undefined;
  };
  const fired = pack.suggestions.flatMap((g, order) => {
    const holds = evalCond(g.when, (ref) => {
      const v = score(ref);
      return v === undefined ? undefined : { kind: 'scale', v, step: 0 };
    });
    if (holds !== true) return [];
    const margin = Math.min(...comparisons(g.when).map((c) => Math.abs(score(c.ref)! - c.value)));
    return [{ g, order, margin: Math.round(margin * 1e4) / 1e4 }];
  });
  const best = new Map<Suggestion['kind'], (typeof fired)[number]>();
  for (const f of fired) {
    const held = best.get(f.g.kind);
    if (!held || f.margin > held.margin) best.set(f.g.kind, f);
  }
  return [...best.values()]
    .sort((a, b) => b.margin - a.margin || a.order - b.order)
    .slice(0, n)
    .map(({ g }) => ({ kind: 'suggestion', suggestion: g.id, about: g.kind, basis: g.basis }));
}

/** The comparisons a rule joins with "and" (the only shape lint allows). */
function comparisons(c: Cond): Extract<Cond, { op: 'cmp' }>[] {
  if (c.op === 'cmp') return [c];
  return c.op === 'and' ? c.args.flatMap(comparisons) : [];
}
