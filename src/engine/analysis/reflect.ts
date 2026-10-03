// Tensions worth sitting with: the most pressing open one for each principle, never involving a
// sensitive topic or item (recommendations stay shareable).
import type { AnswerState } from '../state.ts';
import type { Tension } from '../tensions.ts';
import { ENDORSE, LIMIT } from './constants.ts';
import type { ReflectRec, ReflectVariant } from './types.ts';

/** Whether a tension can appear outside the private Tensions section. */
export function publicTension(s: AnswerState, t: Tension): boolean {
  return [t.a, t.b].every((side) => {
    const topic = s.ix.topics.get(side.topic);
    return topic !== undefined && !topic.sensitive && side.items.every((id) => !s.ix.items.get(id)?.sensitive);
  });
}

export function reflections(s: AnswerState, tensions: readonly Tension[], n: number = LIMIT.reflect): ReflectRec[] {
  const open = tensions
    .filter((t) => t.status === 'open' && publicTension(s, t))
    .sort((x, y) => y.rank - x.rank || (x.key < y.key ? -1 : 1));
  const seen = new Set<string>();
  const out: ReflectRec[] = [];
  for (const t of open) {
    if (out.length >= n) break;
    if (seen.has(t.principle)) continue;
    seen.add(t.principle);
    const [hi, lo] = t.a.e >= t.b.e ? [t.a, t.b] : [t.b, t.a];
    const variant: ReflectVariant = hi.e >= ENDORSE && lo.e <= -ENDORSE ? 'endorse-reject' : hi.e >= ENDORSE ? 'endorse-neutral' : 'neutral-reject';
    out.push({ kind: 'reflect', tension: t.key, principle: t.principle, hi, lo, variant });
  }
  return out;
}
