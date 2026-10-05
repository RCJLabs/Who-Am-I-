import { describe, expect, it } from 'vitest';
import type { TraditionFacts } from '../../engine/analysis/types.ts';
import type { Axis, Principle } from '../../model/content.ts';
import type { Profile } from '../../model/profile.ts';
import { CARD_IDS, isCardId } from '../routes.ts';
import { shareCards, type CardInput, type PatternCard, type PrinciplesCard, type SpectrumCard } from './cards.ts';

const axis = (id: string, family: Axis['family'], poles: [string, string] = [`${id}-`, `${id}+`]): Axis => ({
  id,
  family,
  title: id.toUpperCase(),
  description: '',
  poles,
  minWeight: 1,
  fullWeight: 1,
  minTopics: 1,
});
const scored = (score: number | null, confidence = 1) => ({ score, confidence, weight: 1, spread: 0, topics: 1 });
const principle = (id: string): Principle => ({ id, label: `P ${id}`, definition: '' });

const AXES = [
  axis('econ', 'political', ['Equality', 'Markets']),
  axis('civil', 'political', ['Liberty', 'Authority']),
  axis('change', 'values', ['Stability', 'Change']),
  axis('intuition', 'thinking', ['Intuition', 'Analysis']),
  axis('extraversion', 'personality', ['Reserved', 'Outgoing']),
  axis('neuroticism', 'personality', ['Even-keeled', 'Reactive']),
  axis('beyond_nature', 'worldview', ['Only the natural world', 'More than the natural world']),
  axis('novelty', 'taste', ['Familiar', 'Novel']),
];

function input(over: { axes?: Record<string, ReturnType<typeof scored>>; principles?: Record<string, number>; topics?: number } = {}): CardInput {
  const axes = over.axes ?? {
    econ: scored(-0.8),
    civil: scored(0.1, 0.3),
    change: scored(0.5),
    intuition: scored(0.45),
    extraversion: scored(-0.6),
    neuroticism: scored(0.9),
    beyond_nature: scored(0.9),
    novelty: scored(0.9),
  };
  const principles = Object.fromEntries(Object.entries(over.principles ?? { a: 0.8, b: 0.5, c: -0.3 }).map(([id, s]) => [id, { ...scored(s), byTopic: {}, consistency: null }]));
  return {
    axes: AXES,
    principles: Object.keys(principles).map(principle),
    profile: {
      axes: Object.fromEntries(Object.entries(axes).map(([id, s]) => [id, { ...s, family: AXES.find((a) => a.id === id)!.family }])) as Profile['axes'],
      principles: principles as Profile['principles'],
      scope: { sensitiveIncluded: false, topics: Array.from({ length: over.topics ?? 12 }, (_, k) => `t${k}`) },
    },
  };
}

const card = <T>(cards: ReturnType<typeof shareCards>, id: string) => cards.find((c) => c.id === id) as T | undefined;

describe('share cards', () => {
  it('offers the pattern, then each area there is enough for, in order', () => {
    const cards = shareCards(input());
    expect(cards.map((c) => c.id)).toEqual(['pattern', 'politics', 'values', 'thinking', 'personality', 'principles']);
    expect(cards.every((c) => isCardId(c.id) && CARD_IDS.includes(c.id))).toBe(true);
    expect(isCardId('worldview')).toBe(false);
  });

  it('never draws worldview, taste or a trait the summary leaves unnamed', () => {
    const cards = shareCards(input());
    const text = JSON.stringify(cards);
    for (const word of ['BEYOND_NATURE', 'natural world', 'NOVELTY', 'Novel', 'NEUROTICISM', 'Reactive', 'Even-keeled']) expect(text).not.toContain(word);
    const pattern = card<PatternCard>(cards, 'pattern')!;
    expect(pattern.groups.flatMap((g) => g.spokes.map((s) => s.axis))).toEqual(['econ', 'civil', 'extraversion', 'intuition', 'change']);
    expect(card<SpectrumCard>(cards, 'personality')!.strips.map((s) => s.axis)).toEqual(['extraversion']);
  });

  it('puts the pattern, the firmest leans and the count of topics on the pattern card', () => {
    const pattern = card<PatternCard>(shareCards(input()), 'pattern')!;
    expect(pattern.total).toBe(5);
    expect(pattern.firm.map((f) => f.label)).toEqual(['Strongly Equality', 'Reserved', 'Change']);
    expect(pattern.footer).toBe('My results so far · 12 topics');
    expect(pattern.note).toBe('Hollow marks rest on few answers so far.');
    expect(pattern.alt).toBe(
      'Who Am I, My pattern. 5 spectrums: Politics, Personality, How I think and Values. Firmest leans: Strongly Equality (ECON), Reserved (EXTRAVERSION) and Change (CHANGE). Hollow marks rest on few answers so far. My results so far · 12 topics.',
    );
  });

  it('skips the pattern under three spectrums, and an area with none scored', () => {
    const cards = shareCards(input({ axes: { econ: scored(0.5), extraversion: scored(0.2) }, principles: {} }));
    expect(cards.map((c) => c.id)).toEqual(['politics', 'personality']);
    expect(shareCards(input({ axes: {}, principles: {} }))).toEqual([]);
  });

  it("gives each area's card its line, then every scored spectrum in content order", () => {
    const politics = card<SpectrumCard>(shareCards(input()), 'politics')!;
    expect(politics.line).toBe('Strongly Equality');
    expect(politics.strips).toEqual([
      { axis: 'econ', title: 'ECON', poles: ['Equality', 'Markets'], score: -0.8, confidence: 1, label: 'Strongly Equality', low: false },
      { axis: 'civil', title: 'CIVIL', poles: ['Liberty', 'Authority'], score: 0.1, confidence: 0.3, label: 'Center', low: true },
    ]);
    expect(politics.tradition).toBeNull();
    expect(politics.alt).toBe('Who Am I, Politics. Strongly Equality. ECON: Strongly Equality. CIVIL: Center. Hollow marks rest on few answers so far. My results so far · 12 topics.');
    const values = card<SpectrumCard>(shareCards(input({ axes: { change: scored(0.05) } })), 'values')!;
    expect(values.line).toBe('Near the middle so far');
    expect(values.note).toBeNull();
  });

  it('names the closest political tradition only when the analysis names it', () => {
    const facts = (status: TraditionFacts['status'], named: string[]): TraditionFacts => ({
      status,
      named,
      fits: [
        { tradition: 'x', distance: 0.1, closeness: 'very-close', differences: [] },
        { tradition: 'y', distance: 0.12, closeness: 'close', differences: [] },
      ],
      compared: ['econ', 'civil'],
      missing: [],
      principles: [],
      fit: null,
    });
    const name = (id: string) => ({ x: 'Ex', y: 'Why' })[id] ?? id;
    const politics = (f: TraditionFacts) => card<SpectrumCard>(shareCards({ ...input(), traditions: { facts: f, name } }), 'politics')!;
    expect(politics(facts('match', ['x'])).tradition).toEqual({ label: 'Closest political tradition', name: 'Ex', band: 'Very close fit' });
    expect(politics(facts('match', ['x'])).alt).toContain('Closest political tradition: Ex, very close fit.');
    expect(politics(facts('between', ['x', 'y'])).tradition).toEqual({ label: 'Between two political traditions', name: 'Ex and Why', band: null });
    for (const status of ['loose', 'mixed', 'insufficient'] as const) expect(politics(facts(status, [])).tradition).toBeNull();
    // Only the politics card carries it.
    expect(card<SpectrumCard>(shareCards({ ...input(), traditions: { facts: facts('match', ['x']), name } }), 'values')!.tradition).toBeNull();
  });

  it('draws every principle up to six, and past that the most endorsed and the clearly rejected', () => {
    const few = card<PrinciplesCard>(shareCards(input()), 'principles')!;
    expect(few.bars.map((b) => [b.id, b.words])).toEqual([
      ['a', 'Strongly endorses'],
      ['b', 'Endorses'],
      ['c', 'Leans against it'],
    ]);
    expect(few.skipAt).toBeNull();
    expect(few.line).toBe('Most endorsed: P a and P b');

    const many = card<PrinciplesCard>(shareCards(input({ principles: { a: 0.9, b: 0.8, c: 0.7, d: 0.6, e: 0.5, f: 0.4, g: -0.5, h: -0.9 } })), 'principles')!;
    expect(many.bars.map((b) => b.id)).toEqual(['a', 'b', 'c', 'd', 'g', 'h']);
    expect(many.skipAt).toBe(4);
    // The gap sits between the two groups, even when the first already holds rejected principles.
    const low = card<PrinciplesCard>(shareCards(input({ principles: { a: 0.9, b: -0.2, c: -0.3, d: -0.4, e: -0.5, f: -0.6, g: -0.7 } })), 'principles')!;
    expect([low.bars.map((b) => b.id), low.skipAt]).toEqual([['a', 'b', 'c', 'd', 'f', 'g'], 4]);
    // Nothing clearly rejected: the six most endorsed.
    const none = card<PrinciplesCard>(shareCards(input({ principles: { a: 0.9, b: 0.8, c: 0.7, d: 0.6, e: 0.5, f: 0.4, g: 0.1, h: 0 } })), 'principles')!;
    expect(none.bars.map((b) => b.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(none.skipAt).toBeNull();
    // Too few principles for a card, and the line falls back to a count when nothing stands out.
    expect(card(shareCards(input({ principles: { a: 0.9, b: 0.8 } })), 'principles')).toBeUndefined();
    expect(card<PrinciplesCard>(shareCards(input({ principles: { a: 0.2, b: 0.1, c: 0 } })), 'principles')!.line).toBe('3 principles so far');
  });
});
