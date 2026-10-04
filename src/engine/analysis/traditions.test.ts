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
import { fit as fitOf, matchTraditions, shareableAnswers, type Answers } from './traditions.ts';
import type { TraditionFacts } from './types.ts';

// The fixture pack, placed by the answer sheets in tests/fixtures/content/base/analysis/sheets on
// social [Tradition, Progress] and civil [Liberty, Authority]: reformers (0.7, -0.35) and
// planners (0.5, 0.65) on the left, keepers (-0.7, 0.35) and marketeers (-0.4, -0.65) on the
// right, moderates (0.15, 0) near the middle. The political questions are alpha.stance,
// alpha.circ and alpha.circ_deep (social) and beta.stance (civil).
const b = fixtureBundle();
const pack = fixturePack();

/** A score, or [score, confidence]. */
type Spec = number | [number, number?];

function scored(spec: Spec | undefined): Scored {
  if (spec === undefined) return { score: null, confidence: 0, weight: 0, spread: 0, topics: 0 };
  const [score, confidence = 1] = typeof spec === 'number' ? [spec] : spec;
  return { score, confidence, weight: 1, spread: 0, topics: 1 };
}

/** A profile with these spectrum and principle results; everything else unscored. */
function profile(axes: Record<string, Spec>, principles: Record<string, Spec> = {}): Pick<Profile, 'axes' | 'principles'> {
  return {
    axes: Object.fromEntries(Object.values(b.axes).map((a) => [a.id, { ...scored(axes[a.id]), family: a.family }])),
    principles: Object.fromEntries(Object.keys(b.principles).map((id) => [id, { ...scored(principles[id]), byTopic: {}, consistency: null }])),
  };
}

const score = (spec: Spec | undefined) => (spec === undefined ? 0 : typeof spec === 'number' ? spec : spec[0]);
/** Consistent answers: every political question answered at the score of the spectrum it feeds. */
const consistent = (axes: Record<string, Spec>): Answers =>
  new Map([
    ['alpha.stance', score(axes['social'])],
    ['alpha.circ', score(axes['social'])],
    ['alpha.circ_deep', score(axes['social'])],
    ['beta.stance', score(axes['civil'])],
  ]);
const answersOf = (id: string): Answers => new Map(Object.entries(pack.traditions.find((t) => t.id === id)!.answers));

interface Opts {
  principles?: Record<string, Spec>;
  pack?: AnalysisPack;
  answers?: Answers;
}
const match = (axes: Record<string, Spec>, o: Opts = {}) => matchTraditions(b, profile(axes, o.principles), o.pack ?? pack, o.answers ?? consistent(axes));
const ids = (f: TraditionFacts) => f.fits.map((x) => x.tradition);
const fit = (f: TraditionFacts, id: string) => f.fits.find((x) => x.tradition === id)!;
const withTraditions = (change: Record<string, Partial<Tradition>>): AnalysisPack => ({
  ...pack,
  traditions: pack.traditions.map((t) => ({ ...t, ...change[t.id] })),
});
const reformers = { social: 0.7, civil: -0.35 };
/** Between reformers and moderates, the same distance from each. */
const midway = { social: 0.425, civil: -0.175 };

describe('political traditions', () => {
  it('names the tradition whose targets and answers the user shares', () => {
    for (const t of pack.traditions) {
      const f = match({ social: t.positions['social']!, civil: t.positions['civil']! }, { answers: answersOf(t.id) });
      expect(f, t.id).toMatchObject({ status: 'match', named: [t.id], fit: { gap: 0, questions: 4 }, compared: ['social', 'civil'], missing: [] });
      expect(f.fits[0]).toEqual({ tradition: t.id, distance: 0, closeness: 'very-close', differences: [] });
      expect(f.fits).toHaveLength(3);
    }
  });

  it('needs two scored political spectrums, enough evidence, and four questions in common', () => {
    expect(match({ social: 0.7, warmth: 0.5 })).toMatchObject({ status: 'insufficient', compared: ['social'], missing: ['civil'], fits: [], named: [], fit: null });
    expect(match({ social: [0.7, 0.4], civil: [-0.35, 0.4] })).toMatchObject({ status: 'insufficient', compared: ['social', 'civil'], missing: [] });
    expect(match({ social: [0.7, 0.5], civil: [-0.35, 0.5] }).status).toBe('match');
    const three = new Map([...consistent(reformers)].slice(1));
    expect(match(reformers, { answers: three })).toMatchObject({ status: 'insufficient', fits: [], fit: null });
  });

  it('measures the fit as the RMS gap to the tradition’s own answers', () => {
    const t = pack.traditions.find((x) => x.id === 'reformers')!;
    // Moderates' answers (0, 0.5, 0, 0) against reformers' (0.67, 1, 0.5, -0.33).
    expect(fitOf(t, answersOf('moderates'))).toEqual({ gap: 0.5137, questions: 4 });
    expect(fitOf(t, new Map([['alpha.stance', 2 / 3], ['gamma.belief', 1]]))).toEqual({ gap: 0, questions: 1 });
    expect(fitOf(t, new Map())).toEqual({ gap: 0, questions: 0 });
  });

  it('names a tradition only when the answers follow it question by question', () => {
    // On average at reformers' targets, but each answer far from theirs.
    const pulled: Answers = new Map([
      ['alpha.stance', -1],
      ['alpha.circ', 1],
      ['alpha.circ_deep', 1],
      ['beta.stance', 1],
    ]);
    const f = match(reformers, { answers: pulled });
    expect(f).toMatchObject({ status: 'mixed', named: [], fit: { gap: 1.0961, questions: 4 } });
    expect(ids(f)).toEqual(['reformers', 'moderates']);
    expect(match(reformers, { answers: answersOf('reformers') })).toMatchObject({ status: 'match', named: ['reformers'] });
    // Near the middle the same holds: answers that average out there aren't a view from there.
    const middle = { social: 0.15, civil: 0 };
    expect(match(middle, { answers: pulled })).toMatchObject({ status: 'mixed', named: [] });
    expect(match(middle)).toMatchObject({ status: 'match', named: ['moderates'] });
  });

  it('sits between two traditions about as close, breaking ties by pack order', () => {
    const f = match(midway);
    expect(f).toMatchObject({ status: 'between', named: ['reformers', 'moderates'] });
    expect(f.fits[0]!.distance).toBe(f.fits[1]!.distance);
    // Never between a tradition and one the answers don't follow.
    const leaning: Answers = new Map([
      ['alpha.stance', 1],
      ['alpha.circ', 1],
      ['alpha.circ_deep', 1],
      ['beta.stance', -2 / 3],
    ]);
    expect(match(midway, { answers: leaning })).toMatchObject({ status: 'match', named: ['reformers'] });
  });

  it('calls a far nearest tradition a looser fit, and describes closeness in bands', () => {
    const far = match({ social: -1, civil: -1 });
    expect(far).toMatchObject({ status: 'loose', named: [] });
    expect(far.fits[0]).toMatchObject({ tradition: 'marketeers', closeness: 'little' });
    // Moving away from reformers (0.7, -0.35) along both spectrums at once.
    const bands = [0.1, 0.2, 0.3].map((x) => fit(match({ social: 0.7 + x, civil: -0.35 + x }), 'reformers'));
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
    expect(fit(match(at), 'planners')).toMatchObject({ distance: 0.5303, differences: [{ kind: 'axis', axis: 'civil', toward: 0, gap: 0.75 }] });
    const divided = withTraditions({ planners: { divided: ['civil'] } });
    expect(fit(match(at, { pack: divided }), 'planners')).toMatchObject({ distance: 0.433, differences: [] });
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
    const sure = match(axes, { principles: { autonomy: -0.8, life: 0, duty: 0 }, pack: twins });
    expect(sure).toMatchObject({ status: 'match', named: ['b'], principles: ['autonomy', 'life', 'duty'] });
    expect(fit(sure, 'a').differences).toEqual([{ kind: 'principle', principle: 'autonomy', more: false, gap: 1.6 }]);
    const unsure = match(axes, { principles: { autonomy: [-0.8, 0.9], life: [0, 0.9], duty: [0, 0.9] }, pack: twins });
    expect(unsure).toMatchObject({ status: 'between', named: ['a', 'b'], principles: [] });
  });

  it('names the two biggest differences, on results with enough evidence', () => {
    const f = match({ social: -0.2, civil: 0.85 });
    expect(f.fits[0]).toMatchObject({
      tradition: 'keepers',
      differences: [
        { kind: 'axis', axis: 'social', toward: 1, gap: 0.5 },
        { kind: 'axis', axis: 'civil', toward: 1, gap: 0.5 },
      ],
    });
    expect(fit(match({ social: -0.2, civil: [0.85, 0.4] }), 'keepers').differences).toEqual([{ kind: 'axis', axis: 'social', toward: 1, gap: 0.5 }]);
    expect(match({ social: -0.5, civil: 0.4 }).fits[0]!.differences).toEqual([]);
  });
});

describe('readings for named traditions', () => {
  it('gives a match its inside readings, then its critiques, in authored order', () => {
    const f = match(reformers, { answers: answersOf('reformers') });
    expect(readingsFor(pack, f).map((r) => [r.tradition, r.view, r.reading])).toEqual([
      ['reformers', 'inside', 'reformers_one'],
      ['reformers', 'inside', 'reformers_two'],
      ['reformers', 'outside', 'keepers_one'],
      ['reformers', 'outside', 'moderates_one'],
    ]);
  });

  it('gives one of each from both traditions when between, never the same reading twice', () => {
    expect(readingsFor(pack, match(midway)).map((r) => [r.tradition, r.view, r.reading])).toEqual([
      ['reformers', 'inside', 'reformers_one'],
      ['reformers', 'outside', 'keepers_one'],
      ['moderates', 'inside', 'moderates_one'],
      ['moderates', 'outside', 'reformers_two'],
    ]);
    const shared = withTraditions({ moderates: { outside: ['keepers_one', 'keepers_two'] } });
    expect(readingsFor(shared, match(midway, { pack: shared })).map((r) => r.reading)).toEqual(['reformers_one', 'keepers_one', 'moderates_one', 'keepers_two']);
  });

  it('gives none when no tradition is named', () => {
    expect(readingsFor(pack, match({ social: -1, civil: -1 }))).toEqual([]);
    const pulled: Answers = new Map([
      ['alpha.stance', -1],
      ['alpha.circ', 1],
      ['alpha.circ_deep', 1],
      ['beta.stance', 1],
    ]);
    expect(readingsFor(pack, match(reformers, { answers: pulled }))).toEqual([]);
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
    expect(without.next.suggestions).toEqual([]);
    // Two fixture topics aren't enough evidence to compare.
    expect(withPack.public.traditions).toMatchObject({ status: 'insufficient', compared: ['social', 'civil'] });
    expect({ ...withPack, public: { ...withPack.public, traditions: null }, next: { ...withPack.next, readings: [], suggestions: [] } }).toEqual(without);
  });

  it('compares only answers that could be shared', () => {
    const log = new Log();
    log.add('alpha.stance', scale(7));
    log.add('alpha.circ', scale(5));
    log.add('alpha.circ_deep', scale(4));
    log.add('beta.stance', scale(7));
    log.add('gamma.belief', scale(1));
    const i = input(log);
    // Pretend there's enough evidence, so the comparison runs on both profiles.
    for (const p of [i.profile, i.publicProfile]) for (const id of ['social', 'civil']) p.axes[id] = { ...p.axes[id]!, confidence: 1 };
    expect(i.profile.axes['social']!.score).not.toBe(i.publicProfile.axes['social']!.score);
    const answers = shareableAnswers(i.state);
    expect([...answers.keys()].sort()).toEqual(['alpha.circ', 'alpha.circ_deep', 'alpha.stance', 'beta.stance']);
    const facts = analyse({ ...i, pack });
    expect(facts.public.traditions).toEqual(matchTraditions(b, i.publicProfile, pack, answers));
    expect(facts.public.traditions).not.toEqual(matchTraditions(b, i.profile, pack, answers));
  });
});
