import { describe, expect, it } from 'vitest';
import type { AnalysisPack, Suggestion, TraitNorm } from '../../model/analysis.ts';
import type { Profile } from '../../model/profile.ts';
import { fixtureBundle, fixturePack, Log, scale } from '../../../tests/helpers.ts';
import type { Resolved } from '../normalize.ts';
import { observe } from '../observe.ts';
import { buildProfile } from '../profile.ts';
import { buildAnswerState } from '../state.ts';
import { detectTensions } from '../tensions.ts';
import { analyse } from './index.ts';
import { suggestionsFor } from './suggestions.ts';

function link(id: string, kind: Suggestion['kind'], trait: string, toward: 0 | 1): Suggestion {
  return { id, kind, trait, toward, strength: 'somewhat', outcome: 'interest', interest: id, title: id, away: `${id}, less`, source: 'Test' };
}
const norm = (mean: number, sd: number, reversals: [string, string][] = []): TraitNorm => ({ mean, sd, reversals });
const pack = (norms: Record<string, TraitNorm>, ...suggestions: Suggestion[]) =>
  ({ format: 'whoami.analysis', schema: 1, version: 'test', compare: [], traditions: [], readings: {}, suggestions, norms }) as AnalysisPack;
/** Trait scores and the confidence each rests on. */
function profile(scores: Record<string, [number | null, number]>): Pick<Profile, 'axes'> {
  const axes = Object.fromEntries(
    Object.entries(scores).map(([id, [score, confidence]]) => [id, { score, confidence, weight: 4, spread: 0, topics: 1, family: 'personality' as const }]),
  );
  return { axes };
}
/** Raw item answers, as values -1..1. */
const answers = (values: Record<string, number> = {}) => ({ values: new Map<string, Resolved>(Object.entries(values).map(([id, v]) => [id, { kind: 'scale', v, step: 0 }])) });
const ids = (p: AnalysisPack, scores: Record<string, [number | null, number]>, values?: Record<string, number>) =>
  suggestionsFor(p, profile(scores), answers(values)).map((r) => `${r.suggestion}:${r.end}`);

describe('links from research', () => {
  // A mean of 0.25 and SD of 0.4 in the app's units: the high end needs 0.5 and 0.45, so 0.5;
  // the low end needs -0.5 (and -0.15), so -0.5.
  const p = pack({ warmth: norm(0.25, 0.4) }, link('helping', 'working', 'warmth', 1));

  it('need every item answered', () => {
    expect(ids(p, { warmth: [0.75, 0.75] })).toEqual([]);
    expect(ids(p, { warmth: [0.75, 1] })).toEqual(['helping:toward']);
    expect(ids(p, { warmth: [null, 1] })).toEqual([]);
    expect(ids(p, {})).toEqual([]);
  });

  it('need a clear lean, on the scale and beyond the published mean', () => {
    expect(ids(p, { warmth: [0.375, 1] })).toEqual([]);
    expect(ids(p, { warmth: [0.5, 1] })).toEqual(['helping:toward']);
    expect(ids(p, { warmth: [-0.375, 1] })).toEqual([]);
    expect(ids(p, { warmth: [-0.5, 1] })).toEqual(['helping:away']);
    // With a high mean, a score at 0.5 is no longer half an SD beyond it.
    expect(ids(pack({ warmth: norm(0.4, 0.4) }, link('helping', 'working', 'warmth', 1)), { warmth: [0.5, 1] })).toEqual([]);
    // Without norms, a trait never counts.
    expect(ids(pack({}, link('helping', 'working', 'warmth', 1)), { warmth: [1, 1] })).toEqual([]);
  });

  it('are voided by agreeing with both items of a reversal pair', () => {
    const paired = pack({ warmth: norm(0.25, 0.4, [['traits.t1', 'traits.t2']]) }, link('helping', 'working', 'warmth', 1));
    expect(ids(paired, { warmth: [1, 1] }, { 'traits.t1': 1, 'traits.t2': -1 })).toEqual(['helping:toward']);
    expect(ids(paired, { warmth: [1, 1] }, { 'traits.t1': 1, 'traits.t2': 0.5 })).toEqual([]);
  });

  it('show one of each kind, the clearest lean first, ties going to authored order', () => {
    const many = pack(
      { warmth: norm(0, 0.5), order: norm(0, 0.5) },
      link('first', 'working', 'warmth', 1),
      link('second', 'working', 'order', 1),
      link('spare', 'free_time', 'warmth', 0),
      link('learn', 'subjects', 'order', 0),
    );
    // warmth leans 2 SDs, order 1.
    expect(ids(many, { warmth: [1, 1], order: [0.5, 1] })).toEqual(['first:toward', 'spare:away', 'learn:away']);
    expect(ids(many, { warmth: [0.5, 1], order: [1, 1] })).toEqual(['second:toward', 'learn:away', 'spare:away']);
    expect(suggestionsFor(many, profile({ warmth: [1, 1], order: [0.5, 1] }), answers(), 2).map((r) => r.suggestion)).toEqual(['first', 'spare']);
    expect(suggestionsFor(many, profile({ warmth: [1, 1] }), answers())[0]).toEqual({
      kind: 'suggestion',
      suggestion: 'first',
      about: 'working',
      end: 'toward',
      basis: [{ axis: 'warmth', pole: 1 }],
    });
  });

  it('read only the public profile, and need the pack', () => {
    const b = fixtureBundle();
    const log = new Log();
    for (const [item, step] of [['traits.t1', 5], ['traits.t2', 1], ['traits.t3', 5], ['traits.t4', 1]] as const) log.add(item, scale(step));
    const s = buildAnswerState(b, log.events);
    const o = { appVersion: 't', now: 'x', resolutions: [] };
    const publicProfile = buildProfile(s, { ...o, includeSensitive: false });
    const input = { state: s, profile: buildProfile(s, { ...o, includeSensitive: true }), publicProfile, tensions: detectTensions(s, observe(s, { includeSensitive: true }), []), pack: fixturePack() };
    expect(publicProfile.axes['warmth']).toMatchObject({ score: 1, confidence: 1 });
    const found = (facts: ReturnType<typeof analyse>) => facts.next.suggestions.map((r) => `${r.suggestion}:${r.end}`);
    expect(found(analyse(input))).toEqual(['helping:toward', 'crafts:away']);
    // The private profile never moves them.
    const cool = { ...input.profile, axes: { ...input.profile.axes, warmth: { ...input.profile.axes['warmth']!, score: -1 } } };
    expect(found(analyse({ ...input, profile: cool }))).toEqual(['helping:toward', 'crafts:away']);
    const unscored = { ...publicProfile, axes: { ...publicProfile.axes, warmth: { ...publicProfile.axes['warmth']!, score: null } } };
    expect(analyse({ ...input, publicProfile: unscored }).next.suggestions).toEqual([]);
    expect(analyse({ ...input, pack: null }).next.suggestions).toEqual([]);
  });
});
