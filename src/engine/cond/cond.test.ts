import { describe, expect, it } from 'vitest';
import type { Cond } from '../../model/content.ts';
import { stepValue, type Resolved } from '../normalize.ts';
import { evalCond } from './eval.ts';
import { condRefs, hasTags, mapRefs, parseCond } from './parse.ts';
import { satisfiable, type SatItem } from './sat.ts';

function parse(src: string): Cond {
  const r = parseCond(src);
  if (!r.ok) throw new Error(`parse failed: ${r.message} @${r.col}`);
  return r.cond;
}

function parseErr(src: string): { message: string; col: number } {
  const r = parseCond(src);
  if (r.ok) throw new Error(`expected a parse error for: ${src}`);
  return r;
}

const scale = (step: number, n = 7): Resolved => ({ kind: 'scale', v: stepValue(step, n), step });
const option = (id: string, v?: number): Resolved => (v === undefined ? { kind: 'option', option: id } : { kind: 'option', option: id, v });
const multi = (...tags: string[]): Resolved => ({ kind: 'multi', picks: new Map(tags.map((t) => [t, 1])) });
const lookup = (vals: Record<string, Resolved>) => (ref: string) => vals[ref];

describe('parseCond', () => {
  it('parses a comparison', () => {
    expect(parse('stance < 0')).toEqual({ op: 'cmp', ref: 'stance', cmp: '<', value: 0 });
  });

  it('parses every comparison operator', () => {
    for (const op of ['<', '<=', '>', '>=', '==', '!='] as const) {
      expect(parse(`a ${op} 0.5`)).toEqual({ op: 'cmp', ref: 'a', cmp: op, value: 0.5 });
    }
  });

  it('gives and higher precedence than or', () => {
    expect(parse('a > 0 or b > 0 and c > 0')).toEqual({
      op: 'or',
      args: [
        { op: 'cmp', ref: 'a', cmp: '>', value: 0 },
        {
          op: 'and',
          args: [
            { op: 'cmp', ref: 'b', cmp: '>', value: 0 },
            { op: 'cmp', ref: 'c', cmp: '>', value: 0 },
          ],
        },
      ],
    });
  });

  it('respects parentheses', () => {
    const c = parse('(a > 0 or b > 0) and c > 0');
    expect(c.op).toBe('and');
    if (c.op === 'and') expect(c.args[0]!.op).toBe('or');
  });

  it('binds not tighter than and', () => {
    expect(parse('not a > 0 and b > 0')).toEqual({
      op: 'and',
      args: [
        { op: 'not', arg: { op: 'cmp', ref: 'a', cmp: '>', value: 0 } },
        { op: 'cmp', ref: 'b', cmp: '>', value: 0 },
      ],
    });
  });

  it('parses chained and without nesting', () => {
    const c = parse('a > 0 and b > 0 and c > 0');
    expect(c.op === 'and' && c.args.length).toBe(3);
  });

  it('parses is, has, answered and double negation', () => {
    expect(parse('gest is none')).toEqual({ op: 'is', ref: 'gest', option: 'none' });
    expect(parse('genres has jazz')).toEqual({ op: 'has', ref: 'genres', option: 'jazz' });
    expect(parse('answered(stance)')).toEqual({ op: 'answered', ref: 'stance' });
    expect(parse('not not a is x')).toEqual({ op: 'not', arg: { op: 'not', arg: { op: 'is', ref: 'a', option: 'x' } } });
  });

  it('accepts qualified refs, negative and leading-dot numbers', () => {
    expect(parse('abortion.stance >= 0.33')).toEqual({ op: 'cmp', ref: 'abortion.stance', cmp: '>=', value: 0.33 });
    expect(parse('a <= -0.67')).toEqual({ op: 'cmp', ref: 'a', cmp: '<=', value: -0.67 });
    expect(parse('a>.5')).toEqual({ op: 'cmp', ref: 'a', cmp: '>', value: 0.5 });
  });

  it('records ref uses with columns', () => {
    const r = parseCond('stance < 0 and gest is none');
    expect(r.ok && r.uses).toEqual([
      { ref: 'stance', col: 0, use: 'cmp' },
      { ref: 'gest', col: 15, use: 'is', option: 'none', optionCol: 23 },
    ]);
  });

  it.each([
    ['a < 2', 4, 'between -1 and 1'],
    ['a && b', 2, "Use 'and'"],
    ['a || b', 2, "Use 'or'"],
    ['!a', 0, "Use 'not'"],
    ['a = 1', 2, "Use '=='"],
    ['a < ', 4, 'found end of condition'],
    ['a b', 2, "Expected a comparison, 'is' or 'has' after 'a'"],
    ['a > 0 b > 0', 6, "missing 'and' / 'or'"],
    ['(a > 0', 6, "Expected ')'"],
    ['Stance > 0', 0, 'lowercase'],
    ['a is b.c', 5, 'Expected an option id'],
    ['', 0, 'Expected a condition'],
    ['a > 0 and', 9, 'Expected a condition'],
    ['answered stance', 9, "Expected '(' after answered"],
    ['and > 0', 0, 'Expected a condition'],
    ['a ~ 0', 2, "Unexpected character '~'"],
  ])('reports %j at column %i', (src, col, message) => {
    const err = parseErr(src);
    expect(err.message).toContain(message);
    expect(err.col).toBe(col);
  });
});

describe('ref helpers', () => {
  it('maps, lists and extracts tags', () => {
    const c = parse('a > 0 and (b is x or not m has jazz) and a < 1');
    expect(condRefs(c)).toEqual(['a', 'b', 'm']);
    expect(condRefs(mapRefs(c, (r) => `t.${r}`))).toEqual(['t.a', 't.b', 't.m']);
    expect(hasTags(c, 'm')).toEqual(['jazz']);
    expect(condRefs(undefined)).toEqual([]);
  });
});

describe('evalCond (Kleene logic)', () => {
  const T = parse('a > 0');
  const F = parse('a < 0');
  const U = parse('u > 0');
  const vals = lookup({ a: scale(7) });

  it('treats a missing condition as true', () => {
    expect(evalCond(undefined, vals)).toBe(true);
  });

  it('is unknown when the ref is unanswered', () => {
    expect(evalCond(U, vals)).toBeUndefined();
  });

  it('keeps not of unknown unknown', () => {
    expect(evalCond({ op: 'not', arg: U }, vals)).toBeUndefined();
    expect(evalCond({ op: 'not', arg: T }, vals)).toBe(false);
  });

  it('implements Kleene and', () => {
    expect(evalCond({ op: 'and', args: [F, U] }, vals)).toBe(false);
    expect(evalCond({ op: 'and', args: [U, F] }, vals)).toBe(false);
    expect(evalCond({ op: 'and', args: [T, U] }, vals)).toBeUndefined();
    expect(evalCond({ op: 'and', args: [T, T] }, vals)).toBe(true);
  });

  it('implements Kleene or', () => {
    expect(evalCond({ op: 'or', args: [T, U] }, vals)).toBe(true);
    expect(evalCond({ op: 'or', args: [U, T] }, vals)).toBe(true);
    expect(evalCond({ op: 'or', args: [F, U] }, vals)).toBeUndefined();
    expect(evalCond({ op: 'or', args: [F, F] }, vals)).toBe(false);
  });

  it('makes answered two-valued', () => {
    expect(evalCond(parse('answered(a)'), vals)).toBe(true);
    expect(evalCond(parse('answered(u)'), vals)).toBe(false);
  });

  it('matches two-decimal literals to thirds', () => {
    const third = lookup({ a: scale(5) }); // 1/3 on a 7-point scale
    expect(evalCond(parse('a == 0.33'), third)).toBe(true);
    expect(evalCond(parse('a != 0.33'), third)).toBe(false);
    expect(evalCond(parse('a < 0.33'), third)).toBe(false);
    expect(evalCond(parse('a <= 0.33'), third)).toBe(true);
    expect(evalCond(parse('a > 0.33'), third)).toBe(false);
    expect(evalCond(parse('a >= 0.33'), third)).toBe(true);
    expect(evalCond(parse('a > 0'), third)).toBe(true);
  });

  it('evaluates is / has on the right kinds and unknown otherwise', () => {
    const v = lookup({ g: option('none', -1), m: multi('jazz'), a: scale(1) });
    expect(evalCond(parse('g is none'), v)).toBe(true);
    expect(evalCond(parse('g is any'), v)).toBe(false);
    expect(evalCond(parse('m has jazz'), v)).toBe(true);
    expect(evalCond(parse('m has pop'), v)).toBe(false);
    expect(evalCond(parse('a is none'), v)).toBeUndefined();
    expect(evalCond(parse('g has jazz'), v)).toBeUndefined();
  });

  it('compares option values, unknown when the option has no value', () => {
    expect(evalCond(parse('g < 0'), lookup({ g: option('none', -1) }))).toBe(true);
    expect(evalCond(parse('g < 0'), lookup({ g: option('other') }))).toBeUndefined();
  });

  it('cannot show an item to someone who skipped the stance', () => {
    expect(evalCond(parse('not (stance < 0)'), lookup({}))).toBeUndefined();
  });
});

describe('satisfiable', () => {
  const dom = (n = 7): Resolved[] => Array.from({ length: n }, (_, i) => scale(i + 1, n));
  const item = (id: string, order: number, when?: string, domain: Resolved[] = dom()): SatItem =>
    when === undefined ? { id, order, domain } : { id, order, domain, when: parse(when) };
  const map = (...items: SatItem[]) => new Map(items.map((i) => [i.id, i]));

  it('handles trivially satisfiable and contradictory conditions', () => {
    const items = map(item('a', 0));
    expect(satisfiable(parse('a > 0'), items)).toBe('sat');
    expect(satisfiable(parse('a > 0 and a < 0'), items)).toBe('unsat');
    expect(satisfiable(parse('a > 1'), items)).toBe('unsat');
    expect(satisfiable(undefined, items)).toBe('sat');
  });

  it('only counts refs that could be visible (live semantics)', () => {
    const items = map(item('a', 0), item('b', 1, 'a < 0'));
    expect(satisfiable(parse('a < 0 and b > 0'), items)).toBe('sat');
    expect(satisfiable(parse('a > 0 and b > 0'), items)).toBe('unsat');
  });

  it('follows visibility transitively', () => {
    const items = map(item('a', 0), item('b', 1, 'a > 0'), item('c', 2, 'b > 0'));
    expect(satisfiable(parse('c > 0'), items)).toBe('sat');
    expect(satisfiable(parse('c > 0 and a < 0'), items)).toBe('unsat');
  });

  it('respects fixed domains', () => {
    const items = map(item('stance', 0), item('deep', 1));
    const negative = dom().filter((r) => r.kind === 'scale' && r.v < 0);
    expect(satisfiable(parse('stance < 0'), items, { fix: new Map([['stance', negative]]) })).toBe('sat');
    expect(satisfiable(parse('stance > 0'), items, { fix: new Map([['stance', negative]]) })).toBe('unsat');
    expect(satisfiable(parse('deep > 0'), items, { fix: new Map([['deep', []]]) })).toBe('unsat');
  });

  it('needs an answer for a negated comparison but not for a negated answered', () => {
    const items = map(item('a', 0));
    expect(satisfiable(parse('not (a > 0)'), items)).toBe('sat');
    expect(satisfiable(parse('not (a > 0)'), items, { fix: new Map([['a', []]]) })).toBe('unsat');
    expect(satisfiable(parse('not answered(a)'), items, { fix: new Map([['a', []]]) })).toBe('sat');
  });

  it('enumerates options and multi-select tags', () => {
    const items = map(
      item('g', 0, undefined, [option('none', -1), option('any', 1)]),
      item('m', 1, undefined, [multi(), multi('jazz'), multi('pop'), multi('jazz', 'pop')]),
    );
    expect(satisfiable(parse('g is none and g is any'), items)).toBe('unsat');
    expect(satisfiable(parse('g is any and m has jazz and not m has pop'), items)).toBe('sat');
  });

  it('treats other-topic items as free', () => {
    const items = map(item('a', 0, 'x.s > 0'), { id: 'x.s', order: -1, domain: dom() });
    expect(satisfiable(parse('a > 0'), items)).toBe('sat');
  });

  it('returns unknown for unresolved refs', () => {
    expect(satisfiable(parse('nope > 0'), map(item('a', 0)))).toBe('unknown');
  });

  it('enumerates only the referenced items', () => {
    const many = Array.from({ length: 8 }, (_, i) => item(`i${i}`, i, undefined, dom(11)));
    expect(satisfiable(parse('i0 > 0 and i0 < 0 and i7 > 0'), map(...many))).toBe('unsat');
  });

  it('samples when the referenced domains are too large: sat when found, unknown otherwise', () => {
    const many = Array.from({ length: 8 }, (_, i) => item(`i${i}`, i, undefined, dom(11)));
    const all = many.map((m) => `${m.id} > 0`).join(' and '); // 12^8 assignments
    expect(satisfiable(parse(all), map(...many))).toBe('sat');
    expect(satisfiable(parse(`i0 < 0 and ${all}`), map(...many))).toBe('unknown');
  });
});
