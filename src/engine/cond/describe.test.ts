import { describe, expect, it } from 'vitest';
import { fixtureBundle } from '../../../tests/helpers.ts';
import { indexBundle } from '../bundle-index.ts';
import { describeCond } from './describe.ts';

const ix = indexBundle(fixtureBundle());
const when = (id: string) => ix.items.get(id)!.when!;

describe('describeCond', () => {
  it('names the side of a slider instead of showing numbers', () => {
    expect(describeCond(when('alpha.ch_con'), ix.items)).toBe('stance is on the "Banned" side');
    expect(describeCond(when('alpha.ch_mid'), ix.items)).toBe('stance is in the middle');
    expect(describeCond(when('alpha.limit'), ix.items)).toBe('stance is in the middle or on the "Allowed" side');
  });

  it('joins conjunctions and names chosen options', () => {
    expect(describeCond(when('alpha.ch_circ'), ix.items)).toBe('stance is on the "Banned" side and circ is on the "Allowed" side');
    expect(describeCond(when('alpha.ch_limit'), ix.items)).toBe('stance is on the "Allowed" side and limit is "Always"');
    expect(describeCond(when('tunes.jazz_era'), ix.items)).toBe('genres includes "Jazz"');
  });

  it('parenthesizes mixed and/or and falls back to numbers off the midpoint', () => {
    const c = {
      op: 'or' as const,
      args: [
        { op: 'and' as const, args: [{ op: 'cmp' as const, ref: 'alpha.stance', cmp: '<' as const, value: 0 }, { op: 'answered' as const, ref: 'alpha.circ' }] },
        { op: 'cmp' as const, ref: 'alpha.stance', cmp: '>=' as const, value: 0.67 },
      ],
    };
    expect(describeCond(c, ix.items)).toBe('(stance is on the "Banned" side and circ was answered) or stance >= 0.67');
  });
});
