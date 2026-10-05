import { describe, expect, it } from 'vitest';
import { analyse } from '../../engine/analysis/index.ts';
import { observe } from '../../engine/observe.ts';
import { buildProfile } from '../../engine/profile.ts';
import { buildAnswerState } from '../../engine/state.ts';
import { detectTensions } from '../../engine/tensions.ts';
import type { ReadingRec, TraditionFacts } from '../../engine/analysis/types.ts';
import { fixtureBundle, fixturePack, Log, multi, scale } from '../../../tests/helpers.ts';
import { interestGroups } from '../view.ts';
import { composeAnalysis, tensionGroups, type Analysis } from './compose.ts';

const b = fixtureBundle();

function compose(log: Log): Analysis {
  const s = buildAnswerState(b, log.events);
  const o = { appVersion: 't', now: 'x', resolutions: [] };
  const profile = buildProfile(s, { ...o, includeSensitive: true });
  const publicProfile = buildProfile(s, { ...o, includeSensitive: false });
  const tensions = detectTensions(s, observe(s, { includeSensitive: true }), []);
  const facts = analyse({ state: s, profile, publicProfile, tensions, mapAxes: ['social', 'civil'] });
  return composeAnalysis({ bundle: b, state: s, facts, profile, publicProfile, tensions, interests: interestGroups(profile.interests, s) });
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

  it('writes at most three sentences, never leaving a gap or a NaN', () => {
    const log = new Log();
    log.add('alpha.stance', scale(1));
    log.add('alpha.anchor_auto', scale(7));
    log.add('alpha.ch_con', { kind: 'option', option: 'hold' });
    log.add('beta.stance', scale(7));
    log.add('beta.anchor_auto', scale(1));
    const a = compose(log);
    expect(a.summary.sentences.length).toBeGreaterThan(0);
    expect(a.summary.sentences.length).toBeLessThanOrEqual(3);
    for (const text of strings(a)) expect(text).not.toMatch(/undefined|NaN|null|\s{2}|\(\)/);
    expect(a.summary.sentences).toContain('Politically, you lean strongly toward “Tradition” and “Authority”.');
    // The challenge record has its own tile, so the paragraph leaves it out.
    expect(a.summary.sentences.join(' ')).not.toMatch(/You faced/);
    expect(a.summary.tiles.find((t) => t.id === 'challenges')!.value).toBe(1);
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

describe('taste read-out', () => {
  it('names a favorite from each topic in turn, the topic that matters most first', () => {
    const log = new Log();
    log.add('tunes.love', scale(2));
    log.add('tunes.genres', multi({ jazz: 5, pop: 3 }));
    log.add('snacks.matters', scale(5));
    log.add('snacks.kinds', multi({ nuts: 4 }));
    // Jazz is the strongest single pick, but Snacks matters more; Nuts loses its examples.
    expect(compose(log).readouts.taste?.sentences).toEqual(['Your top picks: Nuts · Jazz · Pop.']);
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

  it('groups every tension by principle for the Tensions page, led by its most pressing pair', () => {
    const log = new Log();
    log.add('alpha.anchor_auto', scale(7));
    log.add('beta.anchor_auto', scale(1));
    const s = buildAnswerState(b, log.events);
    const open = detectTensions(s, observe(s, { includeSensitive: true }), []);
    expect(tensionGroups(b, s, open)).toEqual([
      {
        principle: 'autonomy',
        label: 'Autonomy',
        count: '1 open',
        lead: {
          key: 'autonomy|alpha|beta',
          href: '#/tension/autonomy%7Calpha%7Cbeta',
          label: 'Alpha vs. Beta',
          status: null,
          lead: 'You endorsed “Autonomy” when it comes to alpha, but rejected it when it comes to beta.',
          ask: "Is it other people's health that makes the difference?",
          sides: [
            { title: 'Alpha', e: 1 },
            { title: 'Beta', e: -1 },
          ],
        },
        others: [],
      },
    ]);
    // Thought through: no question, and how it was settled.
    const settled = open.map((t) => ({ ...t, status: 'resolved' as const, resolution: { id: 'r1', key: t.key, kind: 'distinguished' as const, basis: t.basis, at: 0 } }));
    const [group] = tensionGroups(b, s, settled);
    expect(group).toMatchObject({ count: '1 thought through', lead: { ask: null, status: 'You named a difference' } });
  });
});

describe('political traditions in the analysis', () => {
  const pack = fixturePack();

  /** Composes with these tradition facts, as if the answers had led to them. */
  function withTraditions(traditions: TraditionFacts | null, readings: ReadingRec[] = [], withPack = true): Analysis {
    const log = new Log();
    log.add('alpha.stance', scale(1));
    log.add('beta.stance', scale(7));
    const s = buildAnswerState(b, log.events);
    const o = { appVersion: 't', now: 'x', resolutions: [] };
    const profile = buildProfile(s, { ...o, includeSensitive: true });
    const publicProfile = buildProfile(s, { ...o, includeSensitive: false });
    const tensions = detectTensions(s, observe(s, { includeSensitive: true }), []);
    const facts = analyse({ state: s, profile, publicProfile, tensions, mapAxes: ['social', 'civil'] });
    facts.public.traditions = traditions;
    facts.next.readings = readings;
    return composeAnalysis({ bundle: b, state: s, facts, profile, publicProfile, tensions, interests: [], pack: withPack ? pack : null });
  }

  const base = { compared: ['social', 'civil'], missing: [], principles: [], fit: { gap: 0.2, questions: 4 } };
  const match: TraditionFacts = {
    ...base,
    status: 'match',
    named: ['reformers'],
    fits: [
      { tradition: 'reformers', distance: 0.1, closeness: 'very-close', differences: [] },
      { tradition: 'moderates', distance: 0.4, closeness: 'little', differences: [{ kind: 'axis', axis: 'civil', toward: 0, gap: 0.5 }] },
      { tradition: 'planners', distance: 0.5, closeness: 'little', differences: [{ kind: 'principle', principle: 'autonomy', more: true, gap: 0.8 }] },
    ],
  };

  it('names the nearest tradition in the summary and the politics read-out', () => {
    const a = withTraditions(match);
    expect(a.summary.tradition).toBe('Of the political traditions compared here, your answers sit closest to “Reform”.');
    expect(a.readouts.politics!.sentences.at(-1)).toBe('Your political answers sit closest to “Reform”, then “Moderation” and “Planning”.');
    expect(a.traditions).toMatchObject({ status: 'match', basis: 'Compared on “Social” and “Civil”.', reference: { id: 'reformers', name: 'Reform' } });
  });

  it('lists each tradition with its band, differences, and what divides it from the nearest', () => {
    const rows = withTraditions(match).traditions!.rows;
    expect(rows.map((r) => [r.name, r.band, r.differences])).toEqual([
      ['Reform', 'Very close fit', []],
      ['Moderation', 'A looser fit', ['You lean further toward “Liberty”']],
      ['Planning', 'A looser fit', ['You put more weight on “Autonomy”']],
    ]);
    expect(rows[1]!.split).toEqual({ from: 'Reform', text: 'Reformers want change sooner than moderates do.' });
    expect(rows[2]!.split).toEqual({ from: 'Reform', text: 'Reformers trust people to choose; planners trust a common plan.' });
    expect(rows[0]!.split).toBeNull();
    expect(rows[2]!.divided).toBe('Planners are divided on “Life”.');
  });

  it('names two traditions when the answers sit between them', () => {
    const a = withTraditions({ ...match, status: 'between', named: ['reformers', 'planners'] });
    expect(a.summary.tradition).toBe('Of the political traditions compared here, your answers sit between “Reform” and “Planning”.');
    expect(a.traditions!.lead).toBe('Your political answers sit between “Reform” and “Planning”, about as close to each.');
  });

  it('names no tradition when none fits closely or the answers pull apart', () => {
    const loose = withTraditions({ ...match, status: 'loose', named: [] });
    expect(loose.summary.tradition).toBeNull();
    expect(loose.traditions).toMatchObject({ reference: null, lead: 'None of the traditions compared here is a close fit; the nearest are “Reform”, “Moderation” and “Planning”.' });
    const mixed = withTraditions({ ...match, status: 'mixed', named: [], fits: match.fits.slice(0, 2), fit: { gap: 0.8, questions: 4 } });
    expect(mixed.traditions!.lead).toBe(
      'On average your political answers sit nearest “Reform” and “Moderation”, but question by question they pull different ways, so no tradition is named.',
    );
    expect(mixed.readouts.politics!.sentences.at(-1)).toBe(mixed.traditions!.lead);
    expect(mixed.summary.tradition).toBeNull();
  });

  it('says which spectrums need answers, outside the politics read-out', () => {
    const a = withTraditions({ ...base, status: 'insufficient', named: [], fits: [], compared: ['social'], missing: ['civil'], fit: null });
    expect(a.traditions).toMatchObject({ basis: null, rows: [], lead: 'Answer topics on “Civil” to see which political traditions your answers sit closest to.' });
    expect(a.readouts.politics!.sentences).not.toContain(a.traditions!.lead);
    expect(a.summary.tradition).toBeNull();
  });

  it('offers readings from inside a named tradition and its critics, with that tradition', () => {
    const readings: ReadingRec[] = [
      { kind: 'reading', reading: 'reformers_one', tradition: 'reformers', view: 'inside' },
      { kind: 'reading', reading: 'keepers_one', tradition: 'reformers', view: 'outside' },
    ];
    const a = withTraditions(match, readings);
    const [reform, ...others] = a.traditions!.rows;
    // On the Politics page, not among the next steps.
    expect(a.next.flatMap((g) => g.items).some((x) => x.testid.startsWith('rec-read-'))).toBe(false);
    expect(others.every((r) => r.readings.length === 0)).toBe(true);
    expect(reform!.readings).toEqual([
      {
        testid: 'rec-read-reformers_one',
        title: 'The Case for Change',
        detail: 'Argues that rules should change with the times.',
        meta: 'Ada Reform (1990) · Book · The case for “Reform”, from inside it',
      },
      {
        testid: 'rec-read-keepers_one',
        title: 'What Has Worked',
        detail: 'Argues for keeping what works.',
        meta: 'Ed Keep (1970) · Book · A critique of “Reform”, from “Keeping”',
      },
    ]);
  });

  it('reports links from research for the end the answers lean to, collapsed, and only when shown', () => {
    const log = new Log();
    for (const [item, step] of [['traits.t1', 5], ['traits.t2', 1], ['traits.t3', 5], ['traits.t4', 1]] as const) log.add(item, scale(step));
    const s = buildAnswerState(b, log.events);
    const o = { appVersion: 't', now: 'x', resolutions: [] };
    const profile = buildProfile(s, { ...o, includeSensitive: true });
    const publicProfile = buildProfile(s, { ...o, includeSensitive: false });
    const tensions = detectTensions(s, observe(s, { includeSensitive: true }), []);
    const run = (pack: ReturnType<typeof fixturePack> | null, links?: boolean) => {
      const facts = analyse({ state: s, profile, publicProfile, tensions, pack });
      return composeAnalysis({ bundle: b, state: s, facts, profile, publicProfile, tensions, interests: [], pack, ...(links === undefined ? {} : { links }) });
    };
    const group = run(fixturePack()).next.find((g) => g.id === 'links')!;
    expect(group).toMatchObject({ title: 'Links from research', collapsed: { note: 'From your personality answers only.' } });
    expect(group.items).toEqual([
      {
        testid: 'rec-link-helping',
        title: 'Interest in helping and teaching',
        detail:
          "In large studies, people whose answers lean toward “Warm” report somewhat more interest in helping and teaching others, on average. Many don't, so this may not fit you.",
        meta: 'Ways of working · Your answers lean toward “Warm” · Ada Trait, Test Journal (2001)',
      },
      {
        // Read from the other end: the same title, and less of the same activity.
        testid: 'rec-link-crafts',
        title: 'Making things by hand',
        detail:
          "In large studies, people whose answers lean toward “Warm” take part in making things by hand a little less often, on average. Many don't, so this may not fit you.",
        meta: 'Free time · Your answers lean toward “Warm” · Ben Trait, Test Journal (2002)',
      },
    ]);
    expect(run(fixturePack(), false).next.some((g) => g.id === 'links')).toBe(false);
    expect(run(null).next.some((g) => g.id === 'links')).toBe(false);
  });

  it('shows nothing about traditions without the pack', () => {
    const a = withTraditions(match, [{ kind: 'reading', reading: 'reformers_one', tradition: 'reformers', view: 'inside' }], false);
    expect(a.traditions).toBeNull();
    expect(strings(a).join(' ')).not.toMatch(/Reform/);
  });
});
