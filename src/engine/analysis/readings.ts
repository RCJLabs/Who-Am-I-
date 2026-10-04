// Readings for the traditions the analysis names: for one, its first inside and outside readings
// in authored order (the pack lint makes the first critique come from the other side); for two,
// one of each from both. None when no tradition is named, so the summary and readings agree.
import type { AnalysisPack, Tradition } from '../../model/analysis.ts';
import { LIMIT } from './constants.ts';
import type { ReadingRec, TraditionFacts } from './types.ts';

export function readingsFor(pack: AnalysisPack, facts: TraditionFacts): ReadingRec[] {
  const out: ReadingRec[] = [];
  const seen = new Set<string>();
  const take = (t: Tradition, view: ReadingRec['view'], n: number) => {
    let taken = 0;
    for (const id of t[view]) {
      if (taken >= n) break;
      if (seen.has(id) || !pack.readings[id]) continue;
      seen.add(id);
      out.push({ kind: 'reading', reading: id, tradition: t.id, view });
      taken++;
    }
  };
  const named = facts.named.flatMap((id) => pack.traditions.filter((t) => t.id === id));
  if (facts.status === 'match' && named[0]) {
    take(named[0], 'inside', LIMIT.readings.inside);
    take(named[0], 'outside', LIMIT.readings.outside);
  } else if (facts.status === 'between') {
    for (const t of named) {
      take(t, 'inside', 1);
      take(t, 'outside', 1);
    }
  }
  return out;
}
