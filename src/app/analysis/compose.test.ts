import { describe, expect, it } from 'vitest';
import { analyse } from '../../engine/analysis/index.ts';
import { observe } from '../../engine/observe.ts';
import { buildProfile } from '../../engine/profile.ts';
import { buildAnswerState } from '../../engine/state.ts';
import { detectTensions } from '../../engine/tensions.ts';
import { fixtureBundle, Log, scale } from '../../../tests/helpers.ts';
import { interestList } from '../view.ts';
import { composeAnalysis, type Analysis } from './compose.ts';

const b = fixtureBundle();

function compose(log: Log): Analysis {
  const s = buildAnswerState(b, log.events);
  const o = { appVersion: 't', now: 'x', resolutions: [] };
  const profile = buildProfile(s, { ...o, includeSensitive: true });
  const publicProfile = buildProfile(s, { ...o, includeSensitive: false });
  const tensions = detectTensions(s, observe(s, { includeSensitive: true }), []);
  const facts = analyse({ state: s, profile, publicProfile, tensions, mapAxes: ['social', 'civil'] });
  return composeAnalysis({ bundle: b, state: s, facts, profile, publicProfile, tensions, interests: interestList(profile.interests, s) });
}

/** Every string in an analysis. */
function strings(a: Analysis): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(a);
  return out;
}

describe('analysis summary', () => {
  it('heads with the clearest leanings, else principles, else personality, else a plain title', () => {
    expect(compose(new Log()).summary.headline).toBe('Your results so far');

    const politics = new Log();
    politics.add('alpha.stance', scale(1));
    expect(compose(politics).summary.headline).toBe('You lean toward “Tradition”');

    const principles = new Log();
    principles.add('alpha.anchor_auto', scale(7));
    expect(compose(principles).summary.headline).toBe('You lean most on “Autonomy”');

    const personality = new Log();
    for (const [id, step] of [['t1', 5], ['t2', 1], ['t3', 5], ['t4', 1]] as const) personality.add(`traits.${id}`, scale(step));
    expect(compose(personality).summary.headline).toBe('You describe yourself as very warm');
  });

  it('writes at most four sentences, never leaving a gap or a NaN', () => {
    const log = new Log();
    log.add('alpha.stance', scale(1));
    log.add('alpha.anchor_auto', scale(7));
    log.add('alpha.ch_con', { kind: 'option', option: 'hold' });
    log.add('beta.stance', scale(7));
    log.add('beta.anchor_auto', scale(1));
    const a = compose(log);
    expect(a.summary.sentences.length).toBeGreaterThan(0);
    expect(a.summary.sentences.length).toBeLessThanOrEqual(4);
    for (const text of strings(a)) expect(text).not.toMatch(/undefined|NaN|null|\s{2}|\(\)/);
    expect(a.summary.sentences).toContain('Politically, you lean strongly toward “Tradition” and “Authority”.');
  });

  it('keeps sensitive answers out of the summary, while the section read-out shows them', () => {
    const log = new Log();
    log.add('alpha.stance', scale(1));
    log.add('gamma.belief', scale(5));
    const a = compose(log);
    expect(a.summary.headline).toBe('You lean toward “Tradition”');
    expect(a.readouts.politics!.sentences[0]).toBe('Politically, you sit in the middle on “Social”.');
    expect(a.readouts.politics!.sentences[1]).toBe('On “Social” your answers pull both ways: “Alpha” toward “Tradition”, and “Gamma” toward “Progress”.');
    expect(JSON.stringify(a.summary)).not.toContain('Gamma');
    expect(JSON.stringify(a.next)).not.toContain('gamma');
  });
});

describe('analysis next steps', () => {
  it('suggests the topics that would add most, with a reason and a link', () => {
    const explore = compose(new Log()).next.find((g) => g.id === 'explore')!;
    expect(explore.items.map((x) => [x.testid, x.detail, x.href])).toEqual([
      ['rec-explore-alpha', 'Adds the social spectrum to your political map', '#/m/alpha'],
      ['rec-explore-beta', 'Adds the civil spectrum to your political map', '#/m/beta'],
      ['rec-explore-traits', 'Adds your personality profile', '#/m/traits'],
    ]);
  });

  it('pairs the cases against and for a firm position, with their sources', () => {
    const log = new Log();
    log.add('alpha.stance', scale(1));
    log.add('alpha.ch_con', { kind: 'option', option: 'hold' });
    const read = compose(log).next.find((g) => g.id === 'read')!;
    expect(read.items.map((x) => [x.testid, x.detail, x.meta])).toEqual([
      ['rec-case-alpha-ch_con', 'Against your view on Alpha', 'Test source · You held your view'],
      ['rec-case-alpha-ch_pro', 'For your view on Alpha', 'Test source · Put to people on the other side'],
    ]);
  });

  it('asks about the most pressing tensions in plain words', () => {
    const log = new Log();
    log.add('alpha.anchor_auto', scale(7));
    log.add('beta.anchor_auto', scale(1));
    const reflect = compose(log).next.find((g) => g.id === 'reflect')!;
    expect(reflect.items).toEqual([
      {
        testid: 'rec-reflect-autonomy',
        title: 'Autonomy',
        detail: 'You endorsed “Autonomy” when it comes to alpha, but rejected it when it comes to beta. Is it other people\'s health that makes the difference?',
        href: '#/tension/autonomy%7Calpha%7Cbeta',
        cta: 'Think it through',
      },
    ]);
  });
});
