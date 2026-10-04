import { describe, expect, it } from 'vitest';
import type { TensionResolution } from '../model/answers.ts';
import { ProfileSchema } from '../model/profile.ts';
import { fixtureBundle, Log, multi, pick, realBundle, scale } from '../../tests/helpers.ts';
import { engineTensions, runRespondent } from '../../tests/sim/harness.ts';
import { ideologyPolicy, scriptedPolicy } from '../../tests/sim/policies.ts';
import { observe } from './observe.ts';
import { buildProfile } from './profile.ts';
import { challengeSummary, itemHistory } from './shifts.ts';
import { buildAnswerState } from './state.ts';
import { detectTensions, openTensions, principleConsistency } from './tensions.ts';

const b = fixtureBundle();
const topic = (id: string) => b.topics.find((t) => t.id === id)!;

function tensions(log: Log, resolutions: TensionResolution[] = []) {
  const s = buildAnswerState(b, log.events);
  return detectTensions(s, observe(s, { includeSensitive: true }), resolutions);
}

function anchors(alpha: number, beta: number, extra?: (log: Log) => void): Log {
  const log = new Log();
  log.add('alpha.anchor_auto', scale(alpha));
  extra?.(log);
  log.add('beta.anchor_auto', scale(beta));
  return log;
}

describe('tension detection', () => {
  it('flags the same principle applied very differently, in either direction', () => {
    for (const [a, c] of [
      [7, 1],
      [1, 7],
    ]) {
      const [t] = tensions(anchors(a!, c!));
      expect(t).toMatchObject({ key: 'autonomy|alpha|beta', principle: 'autonomy', gap: 2, status: 'open' });
      expect(t!.a.against).toBe("a dependent's life");
      expect(t!.b.against).toBe("other people's health");
    }
  });

  it('uses the gap threshold (1.0 ≈ 3 steps on a 7-point scale)', () => {
    expect(tensions(anchors(7, 4)).map((t) => t.gap)).toEqual([1]);
    expect(tensions(anchors(6, 4))).toEqual([]);
    expect(tensions(anchors(6, 6))).toEqual([]);
  });

  it('ignores circumstance answers: only anchors are compared', () => {
    const log = anchors(5, 5, (l) => {
      l.add('alpha.stance', scale(1));
      l.add('alpha.circ', scale(5));
      l.add('alpha.circ_deep', scale(1));
      l.add('beta.stance', scale(7));
    });
    expect(tensions(log)).toEqual([]);
  });

  it('suppresses a resolved tension until its anchor answers change', () => {
    const log = anchors(7, 1);
    const [t] = tensions(log);
    const res: TensionResolution = { id: 'r1', key: t!.key, at: 1, kind: 'distinguished', reason: 'harm_to_others', basis: t!.basis };
    expect(tensions(log, [res])[0]).toMatchObject({ status: 'resolved', resolution: { reason: 'harm_to_others' } });
    log.add('alpha.anchor_auto', scale(6), { kind: 'manual' }); // still a gap of 5/3
    expect(tensions(log, [res])[0]!.status).toBe('open');
    log.add('alpha.anchor_auto', scale(2), { kind: 'manual' }); // gap closed
    expect(tensions(log, [res])).toEqual([]);
  });

  it('ranks by gap scaled by how much the user cares', () => {
    const low = anchors(7, 1, (l) => l.add('alpha.importance', scale(1)));
    const high = anchors(7, 1, (l) => {
      l.add('alpha.importance', scale(4));
      l.add('beta.importance', scale(4));
    });
    expect(tensions(low)[0]!.rank).toBeCloseTo(2 * 0.5, 10);
    expect(tensions(high)[0]!.rank).toBeCloseTo(2, 10);
  });

  it('reports consistency per principle over anchors', () => {
    const s = buildAnswerState(b, anchors(7, 1).events);
    expect(principleConsistency(s, observe(s, { includeSensitive: true })).get('autonomy')).toBe(0);
  });

  it('is offered at the end of the second topic in a real flow, then not again once resolved', () => {
    const policy = scriptedPolicy({}, ideologyPolicy({}, 'hold'));
    const answers = scriptedPolicy(
      { 'alpha.anchor_auto': scale(7), 'beta.anchor_auto': scale(1), 'alpha.anchor_life': scale(4), 'beta.anchor_life': scale(4) },
      (ctx) => (ctx.item.type === 'slider' ? scale(4) : policy(ctx)),
    );
    const run = runRespondent(b, answers, {
      topics: ['alpha', 'beta'],
      tensions: engineTensions,
      tensionPolicy: () => ({ kind: 'distinguished', reason: 'harm_to_others' }),
    });
    const shown = run.transcript.filter((t) => t.kind === 'tension');
    expect(shown).toEqual([{ topic: 'beta', kind: 'tension', tension: 'autonomy|alpha|beta' }]);
    expect(openTensions(run.state, run.resolutions)).toEqual([]);
  });
});

describe('shifts', () => {
  it('attributes moves to the challenge that prompted them', () => {
    const log = new Log();
    log.add('alpha.stance', scale(2));
    log.add('alpha.ch_con', pick('rethink'));
    log.add('alpha.stance', scale(6), { kind: 'challenge', source: 'alpha.ch_con' });
    log.add('alpha.stance', scale(6), { kind: 'reask', source: 'alpha.check' });
    const s = buildAnswerState(b, log.events);
    const h = itemHistory(s, 'alpha.stance');
    expect(h.initial).toBeCloseTo(-2 / 3, 10);
    expect(h.current).toBeCloseTo(2 / 3, 10);
    expect(h.moves.map((m) => [m.source, m.steps])).toEqual([
      ['alpha.ch_con', 4],
      ['alpha.check', 0],
    ]);
    expect(challengeSummary(s, topic('alpha'))).toMatchObject({ asked: 1, moved: 1, held: 0, distinguished: 0 });
  });

  it('counts held, distinguished, and reconsidered-but-unchanged as held', () => {
    const log = new Log();
    log.add('alpha.stance', scale(1));
    log.add('alpha.circ', scale(5));
    log.add('alpha.ch_con', pick('rethink'));
    log.add('alpha.stance', scale(1), { kind: 'challenge', source: 'alpha.ch_con' });
    log.add('alpha.ch_circ', pick('differ'));
    const summary = challengeSummary(buildAnswerState(b, log.events), topic('alpha'));
    expect(summary).toMatchObject({ asked: 2, moved: 0, held: 1, distinguished: 1, moves: [] });
  });
});

describe('profile', () => {
  function fullRun() {
    const policy = ideologyPolicy({ 'axis:social': 1, 'axis:civil': -1, 'principle:autonomy': 1, 'axis:warmth': 0.5, 'axis:novelty': 1 }, 'yield');
    return runRespondent(b, scriptedPolicy({ 'tunes.genres': multi({ jazz: 5, rock: 2 }), 'tunes.jazz_era': pick('bebop') }, policy), {
      tensions: engineTensions,
      tensionPolicy: () => null,
    });
  }

  it('builds a schema-valid profile', () => {
    const run = fullRun();
    const p = buildProfile(run.state, { includeSensitive: true, appVersion: 't', now: '2026-01-01T00:00:00.000Z', resolutions: run.resolutions });
    expect(() => ProfileSchema.parse(p)).not.toThrow();
    expect(p.axes['social']!.score).toBeGreaterThan(0.4);
    expect(p.axes['civil']!.score).toBeLessThan(-0.4);
    expect(p.axes['future']).toMatchObject({ score: null, confidence: 0, family: 'political' });
    expect(p.interests).toMatchObject({ 'tunes.genres.jazz': 1, 'tunes.genres.rock': 0.4 });
    expect(p.topics['alpha']!.stanceLabel).toBeNull(); // slider without labels
    expect(p.topics['alpha']!.challenges.asked).toBeGreaterThan(0);
  });

  it('records the first stance and where it ended up', () => {
    const log = new Log();
    log.add('alpha.stance', scale(2));
    log.add('alpha.ch_con', pick('rethink'));
    log.add('alpha.stance', scale(5), { kind: 'challenge', source: 'alpha.ch_con' });
    const p = buildProfile(buildAnswerState(b, log.events), { includeSensitive: true, appVersion: 't', now: 'x', resolutions: [] });
    expect(p.topics['alpha']).toMatchObject({ initialStance: -0.6667, stance: 0.3333, challenges: { moved: 1, moves: [{ source: 'alpha.ch_con', steps: 3 }] } });
  });

  it('recomputes without sensitive answers, so they cannot leak through derived scores', () => {
    const log = new Log();
    log.add('alpha.stance', scale(1));
    log.add('gamma.belief', scale(5));
    const s = buildAnswerState(b, log.events);
    const all = buildProfile(s, { includeSensitive: true, appVersion: 't', now: 'x', resolutions: [] });
    const shared = buildProfile(s, { includeSensitive: false, appVersion: 't', now: 'x', resolutions: [] });
    expect(all.axes['social']!.score).toBe(0);
    expect(shared.axes['social']!.score).toBe(-1);
    expect(shared.scope.topics).toEqual(['alpha']);
    expect(Object.keys(shared.topics)).toEqual(['alpha']);
    expect(JSON.stringify(shared)).not.toContain('gamma');
  });

  it('leaves out sensitive items inside a topic that is not sensitive', () => {
    const log = new Log();
    log.add('physical_punishment.stance', scale(4));
    log.add('physical_punishment.moral', scale(5));
    log.add('physical_punishment.school', scale(2));
    const s = buildAnswerState(realBundle(), log.events);
    const all = buildProfile(s, { includeSensitive: true, appVersion: 't', now: 'x', resolutions: [] });
    const shared = buildProfile(s, { includeSensitive: false, appVersion: 't', now: 'x', resolutions: [] });
    expect(all.topics['physical_punishment']!.circumstances).toEqual({ moral: 1, school: -0.5 });
    expect(shared.topics['physical_punishment']!.circumstances).toEqual({ school: -0.5 });
    expect(all.completeness.answered - shared.completeness.answered).toBe(1);
  });
});
