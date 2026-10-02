// Static reachability: can a condition ever be true? Enumerates the finite answer domains of the
// items a condition depends on (transitively through their own `when`), evaluating visibility in
// authored order exactly as the flow does, so a ref only counts if it could actually be shown.
import type { Cond, ItemId } from '../../model/content.ts';
import type { Resolved } from '../normalize.ts';
import { mulberry32 } from '../rng.ts';
import { evalCond } from './eval.ts';
import { condRefs } from './parse.ts';

export interface SatItem {
  id: ItemId;
  when?: Cond;
  /** Values the item can take when answered (unanswered is always also possible unless fixed). */
  domain: readonly Resolved[];
  /** Authored position; items from other topics use -1 and are treated as free. */
  order: number;
}

export interface SatOptions {
  /** Restrict an item's answers to exactly these values. An empty list means "never answered". */
  fix?: ReadonlyMap<ItemId, readonly Resolved[]>;
  limit?: number;
  samples?: number;
}

export type SatResult = 'sat' | 'unsat' | 'unknown';

export function satisfiable(
  target: Cond | undefined,
  items: ReadonlyMap<ItemId, SatItem>,
  opts: SatOptions = {},
): SatResult {
  if (!target) return 'sat';

  const closure = new Map<ItemId, SatItem>();
  let missing = false;
  const visit = (c: Cond | undefined): void => {
    for (const ref of condRefs(c)) {
      if (closure.has(ref)) continue;
      const it = items.get(ref);
      if (!it) {
        missing = true;
        continue;
      }
      closure.set(ref, it);
      if (it.order >= 0) visit(it.when);
    }
  };
  visit(target);
  if (missing) return 'unknown';

  const order = [...closure.values()].sort((a, b) => a.order - b.order);
  const choices: (Resolved | undefined)[][] = order.map((it) => {
    const fixed = opts.fix?.get(it.id);
    if (fixed) return fixed.length ? [...fixed] : [undefined];
    return [undefined, ...it.domain];
  });

  const holds = (pick: (i: number) => Resolved | undefined): boolean => {
    const live = new Map<ItemId, Resolved>();
    const lookup = (ref: string): Resolved | undefined => live.get(ref);
    order.forEach((it, i) => {
      const chosen = pick(i);
      if (chosen === undefined) return;
      if (it.order < 0 || evalCond(it.when, lookup) === true) live.set(it.id, chosen);
    });
    return evalCond(target, lookup) === true;
  };

  const total = choices.reduce((n, c) => n * c.length, 1);
  if (total <= (opts.limit ?? 100_000)) {
    const idx = new Array<number>(order.length).fill(0);
    for (let n = 0; n < total; n++) {
      if (holds((i) => choices[i]![idx[i]!])) return 'sat';
      for (let k = 0; k < idx.length; k++) {
        idx[k]!++;
        if (idx[k]! < choices[k]!.length) break;
        idx[k] = 0;
      }
    }
    return 'unsat';
  }

  const rand = mulberry32(0x5eed);
  const samples = opts.samples ?? 20_000;
  for (let n = 0; n < samples; n++) {
    if (holds((i) => choices[i]![Math.floor(rand() * choices[i]!.length)])) return 'sat';
  }
  return 'unknown';
}
