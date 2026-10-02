// Three-valued (Kleene) evaluation. A ref without a live, value-bearing answer is *unknown*
// (undefined), and an item is shown only when its condition is definitely true. This keeps
// `not (stance < 0)` from showing items to someone who skipped the stance.
import type { Cond } from '../../model/content.ts';
import { numericValue, type Resolved } from '../normalize.ts';

export type Tri = boolean | undefined;
export type Lookup = (ref: string) => Resolved | undefined;

/** Tolerance so that two-decimal literals match thirds: `stance == 0.33` matches 1/3. */
export const EPS = 0.005;

export function evalCond(c: Cond | undefined, value: Lookup): Tri {
  if (!c) return true;
  switch (c.op) {
    case 'and': {
      let unknown = false;
      for (const a of c.args) {
        const r = evalCond(a, value);
        if (r === false) return false;
        if (r === undefined) unknown = true;
      }
      return unknown ? undefined : true;
    }
    case 'or': {
      let unknown = false;
      for (const a of c.args) {
        const r = evalCond(a, value);
        if (r === true) return true;
        if (r === undefined) unknown = true;
      }
      return unknown ? undefined : false;
    }
    case 'not': {
      const r = evalCond(c.arg, value);
      return r === undefined ? undefined : !r;
    }
    case 'answered':
      return value(c.ref) !== undefined;
    case 'cmp': {
      const r = value(c.ref);
      const x = r === undefined ? undefined : numericValue(r);
      if (x === undefined) return undefined;
      return compare(x, c.cmp, c.value);
    }
    case 'is': {
      const r = value(c.ref);
      if (r === undefined || r.kind !== 'option') return undefined;
      return r.option === c.option;
    }
    case 'has': {
      const r = value(c.ref);
      if (r === undefined || r.kind !== 'multi') return undefined;
      return r.picks.has(c.option);
    }
  }
}

export function compare(x: number, op: '<' | '<=' | '>' | '>=' | '==' | '!=', y: number): boolean {
  switch (op) {
    case '<':
      return x < y - EPS;
    case '<=':
      return x <= y + EPS;
    case '>':
      return x > y + EPS;
    case '>=':
      return x >= y - EPS;
    case '==':
      return Math.abs(x - y) <= EPS;
    case '!=':
      return Math.abs(x - y) > EPS;
  }
}
