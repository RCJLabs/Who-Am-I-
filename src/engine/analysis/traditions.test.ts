import { describe, expect, it } from 'vitest';
import type { AnalysisPack, Tradition } from '../../model/analysis.ts';
import type { Profile, Scored } from '../../model/profile.ts';
import { fixtureBundle, fixturePack, Log, scale } from '../../../tests/helpers.ts';
import { observe } from '../observe.ts';
import { buildProfile } from '../profile.ts';
import { buildAnswerState } from '../state.ts';
import { detectTensions } from '../tensions.ts';
import { analyse } from './index.ts';
import { readingsFor } from './readings.ts';
import { matchTraditions } from './traditions.ts';
import type { TraditionFacts } from './types.ts';

// The fixture pack, on social [Tradition, Progress] and civil [Liberty, Authority]:
// reformers (0.7, -0.4) and planners (0.5, 0.5) on the left, keepers (-0.7, 0.4) and
// marketeers (-0.4, -0.6) on the right, moderates (0.1, 0.1) near the middle.
const b = fixtureBundle();
const pack = fixturePack();

/** A score, or [score, confidence, spread]. */
type Spec = number | [number, number?, number?];

function scored(spec: Spec | undefined): Scored {
  if (spec === undefined) return { score: null, confidence: 0, weight: 0, spread: 0, topics: 0 };
  const [score, confidence = 1, spread = 0] = typeof spec === 'number' ? [spec] : spec;
  return { score, confidence, weight: 1, spread, topics: 1 };
}

/** A profile with these spectrum and principle results; everything else unscored. */
function profile(axes: Record<string, Spec>, principles: Record<string, Spec> = {}): Pick<Profile, 'axes' | 'principles'> {
  return {
    axes: Object.fromEntries(Object.values(b.axes).map((a) => [a.id, { ...scored(axes[a.id]), family: a.family }])),
    principles: Object.fromEntries(Object.keys(b.principles).map((id) => [id, { ...scored(principles[id]), byTopic: {}, consistency: null }])),
  };
}

const match = (axes: Record<string, Spec>, principles: Record<string, Spec> = {}, p: AnalysisPack = pack) => matchTraditions(b, profile(axes, principles), p);
const ids = (f: TraditionFacts) => f.fits.map((x) => x.tradition);
const fit = (f: TraditionFacts, id: string) => f.fits.find((x) => x.tradition === id)!;
const withTraditions = (change: Record<string, Partial<Tradition>>): AnalysisPack => ({
  ...pack,
  traditions: pack.traditions.map((t) => ({ ...t, ...change[t.id] })),
});

describe('political traditions', () => {
  it('names the tradition whose targets the answers sit on', () => {
    for (const t of pack.traditions) {
      const f = match({ social: t.positions['social']!, civil: t.positions['civil']! });
      expect(f, t.id).toMatchObject({ status: 'match', named: [t.id], coherence: 0, compared: ['social', 'civil'], missing: [] });
      expect(f.fits[0]).toEqual({ tradition: t.id, distance: 0, closeness: 'very-close', differences: [] });
      expect(f.fits).toHaveLength(3);
    }
  });

  it('needs two scored political spectrums and enough evidence', () => {
    expect(match({ social: 0.7, warmth: 0.5 })).toMatchObject({ status: 'insufficient', compared: ['social'], missing: ['civil'], fits: [], named: [], coherence: null });
    expect(match({ social: [0.7, 0.4], civil: [-0.4, 0.4] })).toMatchObject({ status: 'insufficient', compared: ['social', 'civil'], missing: [] });
    expect(match({ social: [0.7, 0.5], civil: [-0.4, 0.5] }).status).toBe('match');
  });

  it('reads widely spread answers as mixed, listing the nearest two', () => {
    const f = match({ social: [0.7, 1, 0.6], civil: [-0.4, 1, 0.5] });
    expect(f).toMatchObject({ status: 'mixed', reason: 'spread', named: [], spread: ['social', 'civil'], coherence: 0.55 });
    expect(ids(f)).toEqual(['reformers', 'moderates']);
  });

  it('names a tradition near the middle only for consistent answers', () => {
    const noisy = match({ social: [0.1, 1, 0.35], civil: [0.1, 1, 0.35] });
    expect(noisy).toMatchObject({ status: 'mixed', reason: 'center', named: [] });
    expect(ids(noisy)[0]).toBe('moderates');
    expect(match({ social: [0.1, 1, 0.2], civil: [0.1, 1, 0.2] })).toMatchObject({ status: 'match', named: ['moderates'] });
    // Traditions further out aren't held to it.
    expect(match({ social: [0.7, 1, 0.35], civil: [-0.4, 1, 0.35] })).toMatchObject({ status: 'match', named: ['reformers'] });
  });

  it('sits between two traditions about as close, breaking ties by pack order', () => {
    const f = match({ social: 0.6, civil: 0.05 });
    expect(f).toMatchObject({ status: 'between', named: ['reformers', 'planners'] });
    expect(f.fits[0]!.distance).toBe(f.fits[1]!.distance);
    // Never between a tradition and one near the middle the answers aren't consistent enough for.
    expect(match({ social: 0.4, civil: -0.15 })).toMatchObject({ status: 'between', named: ['reformers', 'moderates'] });
    expect(match({ social: [0.4, 1, 0.35], civil: [-0.15, 1, 0.35] })).toMatchObject({ status: 'match', named: ['reformers'] });
  });

  it('calls a far nearest tradition a looser fit, and describes closeness in bands', () => {
    const far = match({ social: -1, civil: -1 });
    expect(far).toMatchObject({ status: 'loose', named: [] });
    expect(far.fits[0]).toMatchObject({ tradition: 'marketeers', closeness: 'little' });
    // Moving away from reformers (0.7, -0.4) along both spectrums at once.
    const bands = [0.1, 0.2, 0.3].map((x) => fit(match({ social: 0.7 + x, civil: -0.4 + x }), 'reformers'));
    expect(bands.map((x) => [x.distance, x.closeness])).toEqual([
      [0.1, 'very-close'],
      [0.2, 'close'],
      [0.3, 'some'],
    ]);
  });

  it('weighs each spectrum by its evidence', () => {
    expect(ids(match({ social: 0.7, civil: 0.2 }))[0]).toBe('planners');
    expect(ids(match({ social: 0.7, civil: [0.2, 0.1] }))[0]).toBe('reformers');
  });

  it('counts what adherents split on half, and never names it as a difference', () => {
    const at = { social: 0.5, civil: -0.1 };
    expect(fit(match(at), 'planners')).toMatchObject({ distance: 0.4243, differences: [{ kind: 'axis', axis: 'civil', toward: 0, gap: 0.6 }] });
    const divided = withTraditions({ planners: { divided: ['civil'] } });
    expect(fit(match(at, {}, divided), 'planners')).toMatchObject({ distance: 0.3464, differences: [] });
  });

  it('brings in compared principles only with enough evidence', () => {
    const twin = (id: string, autonomy: number): Tradition => ({
      ...pack.traditions[1]!,
      id,
      positions: { social: 0.5, civil: 0.5 },
      principles: { autonomy, life: 0, duty: 0 },
      divided: [],
    });
    const twins: AnalysisPack = { ...pack, compare: ['autonomy', 'life', 'duty'], traditions: [twin('a', 0.8), twin('b', -0.8)] };
    const axes = { social: 0.5, civil: 0.5 };
    const sure = match(axes, { autonomy: -0.8, life: 0, duty: 0 }, twins);
    expect(sure).toMatchObject({ status: 'match', named: ['b'], principles: ['autonomy', 'life', 'duty'] });
    expect(fit(sure, 'a').differences).toEqual([{ kind: 'principle', principle: 'autonomy', more: false, gap: 1.6 }]);
    const unsure = match(axes, { autonomy: [-0.8, 0.9], life: [0, 0.9], duty: [0, 0.9] }, twins);
    expect(unsure).toMatchObject({ status: 'between', named: ['a', 'b'], principles: [] });
  });

  it('names the two biggest differences, on results with enough evidence', () => {
    const f = match({ social: -0.2, civil: 0.9 });
    expect(f.fits[0]).toMatchObject({
      tradition: 'keepers',
      differences: [
        { kind: 'axis', axis: 'social', toward: 1, gap: 0.5 },
        { kind: 'axis', axis: 'civil', toward: 1, gap: 0.5 },
      ],
    });
    expect(fit(match({ social: -0.2, civil: [0.9, 0.4] }), 'keepers').differences).toEqual([{ kind: 'axis', axis: 'social', toward: 1, gap: 0.5 }]);
    expect(match({ social: -0.5, civil: 0.4 }).fits[0]!.differences).toEqual([]);
  });
});

describe('readings for named traditions', () => {
  it('gives a match its inside readings, then its critiques, in authored order', () => {
    const f = match({ social: 0.7, civil: -0.4 });
    expect(readingsFor(pack, f).map((r) => [r.tradition, r.view, r.reading])).toEqual([
      ['reformers', 'inside', 'reformers_one'],
      ['reformers', 'inside', 'reformers_two'],
      ['reformers', 'outside', 'keepers_one'],
      ['reformers', 'outside', 'moderates_one'],
    ]);
  });

  it('gives one of each from both traditions when between, never the same reading twice', () => {
    const f = match({ social: 0.6, civil: 0.05 });
    expect(readingsFor(pack, f).map((r) => [r.tradition, r.view, r.reading])).toEqual([
      ['reformers', 'inside', 'reformers_one'],
      ['reformers', 'outside', 'keepers_one'],
      ['planners', 'inside', 'planners_one'],
      ['planners', 'outside', 'marketeers_one'],
    ]);
    const shared = withTraditions({ planners: { outside: ['keepers_one', 'moderates_two'] } });
    expect(readingsFor(shared, match({ social: 0.6, civil: 0.05 }, {}, shared)).map((r) => r.reading)).toEqual([
      'reformers_one',
      'keepers_one',
      'planners_one',
      'moderates_two',
    ]);
  });

  it('gives none when no tradition is named', () => {
    expect(readingsFor(pack, match({ social: -1, civil: -1 }))).toEqual([]);
    expect(readingsFor(pack, match({ social: [0.7, 1, 0.6], civil: [-0.4, 1, 0.5] }))).toEqual([]);
  });
});

describe('traditions in the analysis', () => {
  function input(log: Log) {
    const s = buildAnswerState(b, log.events);
    const o = { appVersion: 't', now: 'x', resolutions: [] };
    return {
      state: s,
      profile: buildProfile(s, { ...o, includeSensitive: true }),
      publicProfile: buildProfile(s, { ...o, includeSensitive: false }),
      tensions: detectTensions(s, observe(s, { includeSensitive: true }), []),
      mapAxes: ['social', 'civil'],
    };
  }

  it('leaves every other fact as it was, and adds nothing without a pack', () => {
    const log = new Log();
    log.add('alpha.stance', scale(2));
    log.add('beta.stance', scale(6));
    const without = analyse(input(log));
    const withPack = analyse({ ...input(log), pack });
    expect(without.public.traditions).toBeNull();
    expect(without.next.readings).toEqual([]);
    // Two fixture topics aren't enough evidence to compare.
    expect(withPack.public.traditions).toMatchObject({ status: 'insufficient', compared: ['social', 'civil'] });
    expect({ ...withPack, public: { ...withPack.public, traditions: null }, next: { ...withPack.next, readings: [] } }).toEqual(without);
  });

  it('compares only answers that could be shared', () => {
    const log = new Log();
    log.add('alpha.stance', scale(7));
    log.add('beta.stance', scale(7));
    log.add('gamma.belief', scale(1));
    const i = input(log);
    // Pretend there's enough evidence, so the comparison runs on both profiles.
    for (const p of [i.profile, i.publicProfile]) for (const id of ['social', 'civil']) p.axes[id] = { ...p.axes[id]!, confidence: 1 };
    expect(i.profile.axes['social']!.score).not.toBe(i.publicProfile.axes['social']!.score);
    const facts = analyse({ ...i, pack });
    expect(facts.public.traditions).toEqual(matchTraditions(b, i.publicProfile, pack));
    expect(facts.public.traditions).not.toEqual(matchTraditions(b, i.profile, pack));
  });
});
