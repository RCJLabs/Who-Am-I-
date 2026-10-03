import { describe, expect, it } from 'vitest';
import type { TensionResolution } from '../../model/answers.ts';
import { fixtureBundle, Log, pick, scale, unsure } from '../../../tests/helpers.ts';
import { observe } from '../observe.ts';
import { buildProfile } from '../profile.ts';
import { buildAnswerState } from '../state.ts';
import { detectTensions } from '../tensions.ts';
import { level } from './axes.ts';
import { citable } from './cases.ts';
import { exploreNext } from './explore.ts';
import { analyse } from './index.ts';

const b = fixtureBundle();

function run(log: Log, resolutions: TensionResolution[] = []) {
  const s = buildAnswerState(b, log.events);
  const o = { appVersion: 't', now: 'x', resolutions };
  const profile = buildProfile(s, { ...o, includeSensitive: true });
  const publicProfile = buildProfile(s, { ...o, includeSensitive: false });
  const tensions = detectTensions(s, observe(s, { includeSensitive: true }), resolutions);
  return { s, profile, publicProfile, facts: analyse({ state: s, profile, publicProfile, tensions, mapAxes: ['social', 'civil'] }) };
}

describe('analysis: spectrums', () => {
  it('describes evidence in three levels', () => {
    expect([0, 0.49, 0.5, 0.79, 0.8, 1].map(level)).toEqual(['low', 'low', 'medium', 'medium', 'high', 'high']);
  });

  it('lists what pulled a spectrum each way, and keeps sensitive answers out of the public facts', () => {
    const log = new Log();
    log.add('alpha.stance', scale(1));
    log.add('gamma.belief', scale(5));
    const { facts } = run(log);
    const social = facts.axes.political.find((a) => a.axis === 'social')!;
    expect(social).toMatchObject({ score: 0, mixed: true, drivers: [[{ topic: 'alpha', x: -1 }], [{ topic: 'gamma', x: 1 }]] });
    const shared = facts.public.axes.political.find((a) => a.axis === 'social')!;
    expect(shared).toMatchObject({ score: -1, mixed: false, drivers: [[{ topic: 'alpha' }], []] });
    expect(JSON.stringify(facts.public)).not.toContain('gamma');
  });
});

describe('analysis: firm positions and cases from both sides', () => {
  it('ranks firm positions by distance from the middle times importance, and ignores a stance last answered "not sure"', () => {
    const log = new Log();
    log.add('alpha.stance', scale(1));
    log.add('alpha.importance', scale(4));
    log.add('beta.stance', scale(6));
    log.add('beta.importance', scale(1));
    expect(run(log).facts.public.positions.map((p) => p.topic)).toEqual(['alpha', 'beta']);
    log.add('alpha.stance', unsure);
    expect(run(log).facts.public.positions.map((p) => p.topic)).toEqual(['beta']);
    // Two steps from the middle of seven is firm; one step isn't.
    log.add('beta.stance', scale(2));
    expect(run(log).facts.public.positions.map((p) => p.topic)).toEqual(['beta']);
    log.add('beta.stance', scale(5));
    expect(run(log).facts.public.positions).toEqual([]);
  });

  it('pairs the cases aimed at your side with the cases put to the other side', () => {
    const log = new Log();
    log.add('alpha.stance', scale(1));
    log.add('alpha.importance', scale(4));
    const cases = run(log).facts.next.cases;
    expect(cases.map((c) => [c.side, c.challenge, c.met])).toEqual([
      ['against', 'alpha.ch_con', null],
      ['for', 'alpha.ch_pro', null],
    ]);
  });

  it('records how you met each case against you', () => {
    const log = new Log();
    log.add('alpha.stance', scale(1));
    log.add('alpha.ch_con', pick('differ'));
    expect(run(log).facts.next.cases[0]).toMatchObject({ challenge: 'alpha.ch_con', met: 'distinguished' });
    log.add('alpha.ch_con', pick('rethink'));
    log.add('alpha.stance', scale(2), { kind: 'challenge', source: 'alpha.ch_con' });
    expect(run(log).facts.next.cases[0]).toMatchObject({ challenge: 'alpha.ch_con', met: 'moved' });
  });

  it('leaves out deep cases the topic skipped because it matters little to you', () => {
    const log = new Log();
    log.add('alpha.stance', scale(7));
    log.add('alpha.importance', scale(1));
    expect(run(log).facts.next.cases.map((c) => [c.side, c.challenge])).toEqual([
      ['against', 'alpha.ch_pro'],
      ['for', 'alpha.ch_con'],
    ]);
  });

  it('only cites real sources', () => {
    expect([citable('Test source'), citable('Original scenario'), citable(' original scenario, after a 2026 law'), citable(undefined)]).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });
});

describe('analysis: topics to explore next', () => {
  it('starts with spectrums that cannot show yet, map spectrums first, and never suggests sensitive topics', () => {
    const recs = run(new Log()).facts.next.explore;
    expect(recs.map((r) => [r.topic, r.reason, r.axis])).toEqual([
      ['alpha', 'map', 'social'],
      ['beta', 'map', 'civil'],
      ['traits', 'show', 'warmth'],
    ]);
    // Even when every topic with something to add is listed, the sensitive one isn't.
    const { s, publicProfile } = run(new Log());
    const all = exploreNext(s, publicProfile, { mapAxes: ['social', 'civil'] }, b.topics.length).map((r) => r.topic);
    expect(all).toEqual(expect.arrayContaining(['alpha', 'beta', 'traits']));
    expect(all).not.toContain('gamma');
  });

  it('puts the topic in progress first', () => {
    const log = new Log();
    log.add('alpha.stance', scale(2));
    const recs = run(log).facts.next.explore;
    expect(recs[0]).toEqual({ kind: 'explore', topic: 'alpha', reason: 'finish' });
    expect(recs.map((r) => r.topic)).not.toContain('gamma');
  });

  it('suggests testing a strongly held principle in a second setting', () => {
    const log = new Log();
    log.add('alpha.anchor_auto', scale(7));
    const { s, publicProfile } = run(log);
    // Pretend the civil spectrum is already well established, so only the principle is new.
    publicProfile.axes['civil'] = { ...publicProfile.axes['civil']!, score: 0.5, confidence: 1 };
    const beta = exploreNext(s, publicProfile).find((r) => r.topic === 'beta');
    expect(beta).toEqual({ kind: 'explore', topic: 'beta', reason: 'consistency', principle: 'autonomy' });
  });
});

describe('analysis: tensions to reflect on', () => {
  const anchors = (alpha: number, beta: number) => {
    const log = new Log();
    log.add('alpha.anchor_auto', scale(alpha));
    log.add('beta.anchor_auto', scale(beta));
    return log;
  };

  it('names which side endorses the principle and how the other side differs', () => {
    const cases: [number, number, string][] = [
      [7, 1, 'endorse-reject'],
      [7, 3, 'endorse-neutral'],
      [4, 1, 'neutral-reject'],
    ];
    for (const [a, c, variant] of cases) {
      const [r] = run(anchors(a, c)).facts.next.reflect;
      expect(r).toMatchObject({ tension: 'autonomy|alpha|beta', principle: 'autonomy', variant, hi: { topic: 'alpha' }, lo: { topic: 'beta', against: "other people's health" } });
    }
  });

  it('keeps one per principle and drops tensions already thought through', () => {
    const log = anchors(7, 1);
    log.add('alpha.anchor_life', scale(1));
    log.add('beta.anchor_life', scale(7));
    const { facts, s } = run(log);
    expect(facts.next.reflect.map((r) => r.principle).sort()).toEqual(['autonomy', 'life']);
    const t = detectTensions(s, observe(s, { includeSensitive: true }), []).find((x) => x.principle === 'life')!;
    const resolved: TensionResolution = { id: 'r1', at: 1, key: t.key, kind: 'acknowledged', basis: t.basis };
    expect(run(log, [resolved]).facts.next.reflect.map((r) => r.principle)).toEqual(['autonomy']);
    expect(run(log, [resolved]).facts.public.tensions).toEqual({ open: 1, top: 'autonomy' });
  });
});
