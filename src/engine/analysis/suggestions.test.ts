import { describe, expect, it } from 'vitest';
import type { AnalysisPack, Suggestion } from '../../model/analysis.ts';
import type { Cond } from '../../model/content.ts';
import type { Profile } from '../../model/profile.ts';
import { fixtureBundle, fixturePack, Log, scale } from '../../../tests/helpers.ts';
import { observe } from '../observe.ts';
import { buildProfile } from '../profile.ts';
import { buildAnswerState } from '../state.ts';
import { detectTensions } from '../tensions.ts';
import { analyse } from './index.ts';
import { suggestionsFor } from './suggestions.ts';

type Cmp = Extract<Cond, { op: 'cmp' }>;
const toward = (ref: string, cmp: '<' | '>', value: number): Cmp => ({ op: 'cmp', ref, cmp, value });
function suggestion(id: string, kind: Suggestion['kind'], ...rule: Cmp[]): Suggestion {
  return {
    id,
    kind,
    when: rule.length === 1 ? rule[0]! : { op: 'and', args: rule },
    basis: rule.map((c) => ({ axis: c.ref, pole: c.cmp === '<' ? 0 : 1 })),
    title: id,
    text: id,
    source: 'Test',
  };
}
const pack = (...suggestions: Suggestion[]) =>
  ({ format: 'whoami.analysis', schema: 1, version: 'test', compare: [], traditions: [], readings: {}, suggestions }) as AnalysisPack;
/** Spectrum scores and the confidence each rests on. */
function profile(scores: Record<string, [number | null, number]>): Pick<Profile, 'axes'> {
  const axes = Object.fromEntries(
    Object.entries(scores).map(([id, [score, confidence]]) => [id, { score, confidence, weight: 4, spread: 0, topics: 1, family: 'personality' as const }]),
  );
  return { axes };
}
const ids = (p: AnalysisPack, scores: Record<string, [number | null, number]>) => suggestionsFor(p, profile(scores)).map((r) => r.suggestion);

describe('personal suggestions', () => {
  it('fire only on spectrums scored with enough evidence', () => {
    const p = pack(suggestion('warm', 'social', toward('warmth', '>', 0.25)));
    expect(ids(p, { warmth: [0.5, 0.5] })).toEqual([]);
    expect(ids(p, { warmth: [0.5, 0.75] })).toEqual(['warm']);
    expect(ids(p, { warmth: [null, 1] })).toEqual([]);
    expect(ids(p, {})).toEqual([]);
  });

  it('need every threshold cleared, toward the pole the rule names', () => {
    const p = pack(suggestion('both', 'work', toward('warmth', '>', 0.25), toward('order', '<', -0.25)));
    expect(ids(p, { warmth: [0.5, 1], order: [-0.5, 1] })).toEqual(['both']);
    expect(ids(p, { warmth: [0.5, 1], order: [0.5, 1] })).toEqual([]);
    expect(ids(p, { warmth: [0.5, 1], order: [-0.25, 1] })).toEqual([]);
    // A spectrum without enough evidence leaves the rule unknown, so it doesn't fire.
    expect(ids(p, { warmth: [0.5, 1], order: [-0.5, 0.5] })).toEqual([]);
  });

  it('show one of each kind, the one cleared by the widest margin, and the clearest kinds first', () => {
    const p = pack(
      suggestion('work_near', 'work', toward('warmth', '>', 0.5)),
      suggestion('work_far', 'work', toward('warmth', '>', 0.25)),
      suggestion('learn', 'learning', toward('order', '<', -0.25)),
      suggestion('meet', 'social', toward('warmth', '>', 0.25), toward('order', '<', -0.25)),
      suggestion('do', 'activity', toward('order', '<', -0.25)),
    );
    // warmth clears 0.25 by 0.5 and 0.5 by 0.25; order clears -0.25 by 0.125.
    const recs = suggestionsFor(p, profile({ warmth: [0.75, 1], order: [-0.375, 1] }));
    expect(recs.map((r) => [r.suggestion, r.about])).toEqual([
      ['work_far', 'work'],
      ['learn', 'learning'],
      ['meet', 'social'],
    ]);
    expect(recs[2]!.basis).toEqual([
      { axis: 'warmth', pole: 1 },
      { axis: 'order', pole: 0 },
    ]);
    expect(suggestionsFor(p, profile({ warmth: [0.75, 1], order: [-0.375, 1] }), 4).map((r) => r.suggestion)).toEqual(['work_far', 'learn', 'meet', 'do']);
  });

  it('break ties by authored order', () => {
    const p = pack(suggestion('first', 'work', toward('warmth', '>', 0.25)), suggestion('second', 'work', toward('order', '>', 0.25)));
    expect(ids(p, { warmth: [0.5, 1], order: [0.5, 1] })).toEqual(['first']);
  });

  it('read only the public profile, and need the pack', () => {
    const b = fixtureBundle();
    const fixture = fixturePack();
    const log = new Log();
    for (const [item, step] of [['traits.t1', 5], ['traits.t2', 1], ['traits.t3', 5]] as const) log.add(item, scale(step));
    const s = buildAnswerState(b, log.events);
    const o = { appVersion: 't', now: 'x', resolutions: [] };
    const publicProfile = buildProfile(s, { ...o, includeSensitive: false });
    const input = { state: s, profile: buildProfile(s, { ...o, includeSensitive: true }), publicProfile, tensions: detectTensions(s, observe(s, { includeSensitive: true }), []), pack: fixture };
    expect(publicProfile.axes['warmth']).toMatchObject({ score: 1, confidence: 0.75 });
    expect(analyse(input).next.suggestions).toEqual([{ kind: 'suggestion', suggestion: 'warm_company', about: 'social', basis: [{ axis: 'warmth', pole: 1 }] }]);
    // The private profile never moves them.
    const cool = { ...input.profile, axes: { ...input.profile.axes, warmth: { ...input.profile.axes['warmth']!, score: -1 } } };
    expect(analyse({ ...input, profile: cool }).next.suggestions.map((r) => r.suggestion)).toEqual(['warm_company']);
    const unscored = { ...publicProfile, axes: { ...publicProfile.axes, warmth: { ...publicProfile.axes['warmth']!, score: null } } };
    expect(analyse({ ...input, publicProfile: unscored }).next.suggestions).toEqual([]);
    expect(analyse({ ...input, pack: null }).next.suggestions).toEqual([]);
  });
});
