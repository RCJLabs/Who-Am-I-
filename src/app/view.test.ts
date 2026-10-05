import { describe, expect, it } from 'vitest';
import type { Item } from '../model/content.ts';
import { buildAnswerState } from '../engine/state.ts';
import { buildProfile } from '../engine/profile.ts';
import { fixtureBundle, fixturePack, Log, multi, pick, scale, skip } from '../../tests/helpers.ts';
import { AREAS, CARD_IDS, parseHash, to } from './routes.ts';
import type { Axis, Principle } from '../model/content.ts';
import type { Profile } from '../model/profile.ts';
import {
  activeTopic,
  answerLabel,
  areaLean,
  axisFeeders,
  challengeTotals,
  compareWith,
  endorsementLabel,
  firmestLeans,
  interestList,
  mapTraditions,
  mapViews,
  nextTopic,
  orderedOptions,
  patternGroups,
  positionLabel,
  positionsByDomain,
  rankedPrinciples,
  traditionTable,
  sources,
  strongestLeanings,
  toFivePoint,
  toPercent,
  topicStatus,
} from './view.ts';

const b = fixtureBundle();
const item = (id: string): Item => b.topics.flatMap((t) => t.items).find((i) => i.id === id)!;
const topic = (id: string) => b.topics.find((t) => t.id === id)!;

describe('routes', () => {
  it.each([
    ['', { name: 'home' }],
    ['#/', { name: 'home' }],
    ['#/topics', { name: 'topics' }],
    ['#/m/abortion', { name: 'flow', topic: 'abortion' }],
    ['#/m/abortion?edit=stance', { name: 'flow', topic: 'abortion', edit: 'stance' }],
    ['#/results', { name: 'results' }],
    ['#/results/abortion', { name: 'topic-results', topic: 'abortion' }],
    ['#/tension/a%7Cb%7Cc', { name: 'tension', key: 'a|b|c' }],
    ['#/area/politics', { name: 'area', area: 'politics' }],
    ['#/area/nope', { name: 'results' }],
    ['#/area', { name: 'results' }],
    ['#/share', { name: 'share', card: null }],
    ['#/share/politics', { name: 'share', card: 'politics' }],
    ['#/share/worldview', { name: 'share', card: null }],
    ['#/settings', { name: 'settings' }],
    ['#/nope', { name: 'not-found', path: '/nope' }],
  ])('parses %j', (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it('round-trips hrefs', () => {
    expect(parseHash(to.flow('vaccine_mandates', 'anchor_ba'))).toEqual({ name: 'flow', topic: 'vaccine_mandates', edit: 'anchor_ba' });
    expect(parseHash(to.tension('bodily_autonomy|abortion|vaccine_mandates'))).toEqual({ name: 'tension', key: 'bodily_autonomy|abortion|vaccine_mandates' });
    for (const area of AREAS) expect(parseHash(to.area(area))).toEqual({ name: 'area', area });
    for (const card of CARD_IDS) expect(parseHash(to.share(card))).toEqual({ name: 'share', card });
    expect(parseHash(to.share())).toEqual({ name: 'share', card: null });
  });
});

describe('answerLabel', () => {
  it('uses scale labels, or describes unlabeled sliders by their poles', () => {
    expect(answerLabel(item('alpha.anchor_auto'), scale(7))).toBe('Strongly agree');
    expect(answerLabel(item('alpha.importance'), scale(2))).toBe('A little');
    expect(answerLabel(item('alpha.stance'), scale(1))).toBe('Banned');
    expect(answerLabel(item('alpha.stance'), scale(4))).toBe('In between');
    expect(answerLabel(item('alpha.stance'), scale(6))).toBe('Leaning “Allowed”');
  });

  it('names options, multi-select picks and non-answers', () => {
    expect(answerLabel(item('alpha.limit'), pick('any'))).toBe('Always');
    expect(answerLabel(item('tunes.genres'), multi({ jazz: 5, rock: 2 }))).toBe('Jazz (5/5), Rock (2/5)');
    expect(answerLabel(item('tunes.genres'), multi({}))).toBe('None of these');
    expect(answerLabel(item('alpha.circ'), skip)).toBe('Skipped');
  });
});

describe('topic navigation', () => {
  it('reports status, the active topic and the next unfinished topic', () => {
    const log = new Log();
    expect(topicStatus(buildAnswerState(b, log.events), topic('beta'))).toEqual({ started: false, answered: 0, remaining: 7, complete: false });
    log.add('beta.stance', scale(4));
    let s = buildAnswerState(b, log.events);
    expect(activeTopic(s)?.id).toBe('beta');
    // gamma comes next in order, but it's a deep dive: core topics are offered first.
    expect(nextTopic(b, s, 'beta')?.id).toBe('traits');
    expect(nextTopic(b, s)?.id).toBe('alpha');
    for (const id of ['beta.importance', 'beta.anchor_auto', 'beta.anchor_life']) log.add(id, skip);
    log.add('beta.ch_mid', pick('abstain'));
    log.add('beta.stance', scale(4), { kind: 'reask', source: 'beta.check' });
    s = buildAnswerState(b, log.events);
    expect(topicStatus(s, topic('beta')).complete).toBe(true);
    expect(activeTopic(s)).toBeNull();
  });

  it('never names or suggests a sensitive topic outside it', () => {
    // gamma is sensitive; give it a second question so one answer leaves it unfinished.
    const b2 = structuredClone(b);
    const gamma = b2.topics.find((t) => t.id === 'gamma')!;
    gamma.items.push({ ...gamma.items[0]!, id: 'gamma.more', key: 'more' });
    const log = new Log();
    log.add('gamma.belief', scale(2));
    const s = buildAnswerState(b2, log.events);
    expect(gamma.sensitive).toBe(true);
    expect(topicStatus(s, gamma).complete).toBe(false);
    // Unfinished, but Home doesn't name it.
    expect(activeTopic(s)).toBeNull();
    // Whichever topic was just finished, the next one offered is never gamma.
    for (const t of [undefined, ...b2.topics.map((x) => x.id)]) expect(nextTopic(b2, s, t)?.id).not.toBe('gamma');
    // A topic that isn't sensitive is still picked up where it was left.
    log.add('alpha.stance', scale(4));
    expect(activeTopic(buildAnswerState(b2, log.events))?.id).toBe('alpha');
  });
});

describe('orderedOptions', () => {
  const opts = Array.from({ length: 8 }, (_, i) => ({ id: `o${i}`, label: `O${i}` }));

  it('keeps authored order unless shuffling, and shuffles stably per user and item', () => {
    expect(orderedOptions(opts, false, 's', 'x')).toEqual(opts);
    const a = orderedOptions(opts, true, 'seed', 'item');
    expect(orderedOptions(opts, true, 'seed', 'item')).toEqual(a);
    expect([...a].sort((x, y) => x.id.localeCompare(y.id))).toEqual(opts);
    expect(orderedOptions(opts, true, 'other-seed', 'item')).not.toEqual(a);
  });
});

describe('content helpers', () => {
  it('maps axes to the topics that feed them', () => {
    const feeders = axisFeeders(b);
    expect(feeders.get('social')!.map((t) => t.id)).toEqual(['alpha', 'gamma']);
    expect(feeders.get('future')).toBeUndefined();
  });

  it('lists sources once', () => {
    expect(sources(b).map((s) => s.source)).toEqual(['Test source', 'Test instrument']);
  });

  it('converts scores for display', () => {
    expect(toPercent(-1)).toBe(0);
    expect(toPercent(0.5)).toBe(75);
    expect(toFivePoint(-1)).toBe(1);
    expect(toFivePoint(0)).toBe(3);
    expect(toFivePoint(1)).toBe(5);
  });
});

describe('results helpers', () => {
  const scored = (score: number | null, confidence = 1) => ({ score, confidence, weight: 1, spread: 0, topics: 1 });
  const axis = (id: string, poles: [string, string]): Axis => ({ id, family: 'political', title: id.toUpperCase(), description: '', poles, minWeight: 1, fullWeight: 1, minTopics: 1 });

  it('names positions and endorsements in plain words, band by band', () => {
    const poles: [string, string] = ['Tradition', 'Progress'];
    expect([-0.9, -0.5, -0.2, 0, 0.2, 0.5, 0.9].map((s) => positionLabel(s, poles))).toEqual([
      'Strongly Tradition',
      'Tradition',
      'Leans Tradition',
      'Center',
      'Leans Progress',
      'Progress',
      'Strongly Progress',
    ]);
    expect([-0.9, -0.5, -0.2, 0.1, 0.2, 0.5, 0.9].map(endorsementLabel)).toEqual([
      'Strongly rejects',
      'Rejects',
      'Leans against it',
      'Neutral',
      'Leans toward it',
      'Endorses',
      'Strongly endorses',
    ]);
  });

  it('picks the clearest leanings: past "leans", strongest and best-evidenced first, at most three', () => {
    const axes = [axis('a', ['A-', 'A+']), axis('b', ['B-', 'B+']), axis('c', ['C-', 'C+']), axis('d', ['D-', 'D+']), axis('e', ['E-', 'E+'])];
    const scores = { a: { ...scored(0.9, 0.5), family: 'political' }, b: { ...scored(-0.6), family: 'political' }, c: { ...scored(0.3), family: 'political' }, d: { ...scored(null), family: 'political' }, e: { ...scored(0.8), family: 'political' } } as Profile['axes'];
    expect(strongestLeanings(axes, scores).map((l) => l.label)).toEqual(['Strongly E+', 'B-', 'Strongly A+']);
    expect(strongestLeanings(axes, scores, 1)).toEqual([{ axis: 'e', title: 'E', label: 'Strongly E+' }]);
  });

  it('draws the overview pattern from four areas, without unnamed traits, unscored spectrums, worldview or taste', () => {
    const ax = (id: string, family: Axis['family'], poles: [string, string]): Axis => ({ ...axis(id, poles), family });
    const axes = [
      ax('econ', 'political', ['Equality', 'Markets']),
      ax('kind', 'personality', ['Tough', 'Warm']),
      ax('moody', 'personality', ['Calm', 'Reactive']),
      ax('change', 'values', ['Stability', 'Change']),
      ax('god', 'worldview', ['Natural', 'More']),
      ax('tune', 'taste', ['Popular', 'Niche']),
      ax('steady', 'thinking', ['Steady', 'Flexible']),
    ];
    const scores = {
      econ: { ...scored(-0.75, 0.6), family: 'political' },
      kind: { ...scored(0.5, 0.4), family: 'personality' },
      moody: { ...scored(0.9), family: 'personality' },
      change: { ...scored(0.1), family: 'values' },
      god: { ...scored(1), family: 'worldview' },
      tune: { ...scored(-1), family: 'taste' },
      steady: { ...scored(null), family: 'thinking' },
    } as Profile['axes'];
    const unnamed = new Set(['moody']);

    // Ring order, one spoke per scored spectrum; the length ignores the evidence, which shows as hollow.
    expect(patternGroups(axes, scores, unnamed)).toEqual([
      { area: 'politics', spokes: [{ axis: 'econ', title: 'ECON', label: 'Strongly Equality', strength: 0.75, low: false }] },
      { area: 'personality', spokes: [{ axis: 'kind', title: 'KIND', label: 'Warm', strength: 0.5, low: true }] },
      { area: 'values', spokes: [{ axis: 'change', title: 'CHANGE', label: 'Center', strength: 0.1, low: false }] },
    ]);
    // The headline's rule: past "leans", by strength times evidence. Near the middle never counts.
    expect(firmestLeans(axes, scores, unnamed)).toEqual([
      { axis: 'econ', title: 'ECON', label: 'Strongly Equality', area: 'politics' },
      { axis: 'kind', title: 'KIND', label: 'Warm', area: 'personality' },
    ]);
    expect(firmestLeans(axes, scores, unnamed, 1).map((l) => l.axis)).toEqual(['econ']);
    expect(areaLean(axes, scores, 'personality', unnamed)).toBe('Warm');
    expect(areaLean(axes, scores, 'values', unnamed)).toBeNull();
    expect(areaLean(axes, scores, 'thinking', unnamed)).toBeNull();
  });

  it("an area card's line names its two clearest positions, best evidenced first", () => {
    const axes = [axis('a', ['A-', 'A+']), axis('b', ['B-', 'B+']), axis('c', ['C-', 'C+'])];
    const scores = { a: { ...scored(0.2), family: 'political' }, b: { ...scored(-0.8, 0.3), family: 'political' }, c: { ...scored(0.5), family: 'political' } } as Profile['axes'];
    expect(areaLean(axes, scores, 'political', new Set())).toBe('C+ · Strongly B-');
  });

  it('ranks scored principles from most endorsed to most rejected', () => {
    const p = (id: string): Principle => ({ id, label: id, definition: '' });
    const scores = {
      x: { ...scored(-0.4), byTopic: {}, consistency: null },
      y: { ...scored(0.7), byTopic: {}, consistency: null },
      z: { ...scored(null), byTopic: {}, consistency: null },
    } as Profile['principles'];
    expect(rankedPrinciples([p('x'), p('y'), p('z'), p('w')], scores).map((r) => [r.principle.id, r.score])).toEqual([
      ['y', 0.7],
      ['x', -0.4],
    ]);
  });

  it('sums how challenges were handled, and groups positions by domain in content order', () => {
    const result = (stance: number | null, held: number, distinguished: number, moved: number) => ({
      stance,
      stanceLabel: null,
      initialStance: null,
      importance: null,
      complete: true,
      circumstances: {},
      challenges: { asked: held + distinguished + moved, held, distinguished, moved, moves: [] },
    });
    const topics = { alpha: result(0.5, 1, 1, 0), beta: result(null, 0, 0, 0), gamma: result(-1, 2, 0, 1) } as Profile['topics'];
    expect(challengeTotals(topics)).toEqual({ asked: 5, held: 3, distinguished: 1, moved: 1 });
    // beta has no stance answer yet and gamma has no stance item, so only alpha is a position.
    expect(positionsByDomain(b, topics).map((g) => [g.domain.id, g.topics.map((t) => t.id)])).toEqual([['life', ['alpha']]]);
  });

  it('lists interests strongest first: picks by option and ratings by question, with the answer', () => {
    const log = new Log();
    log.add('tunes.genres', multi({ jazz: 5, rock: 2 }));
    log.add('tunes.love', scale(4));
    const s = buildAnswerState(b, log.events);
    const p = buildProfile(s, { includeSensitive: true, appVersion: 't', now: 'x', resolutions: [] });
    expect(interestList(p.interests, s)).toEqual([
      { key: 'tunes.genres.jazz', kind: 'pick', label: 'Jazz', v: 1 },
      { key: 'tunes.love', kind: 'rating', label: 'How much does music matter to you?', answer: 'Leaning “Hugely”', v: 0.75 },
      { key: 'tunes.genres.rock', kind: 'pick', label: 'Rock', v: 0.4 },
    ]);
  });
});

describe('political traditions on the map and in the table', () => {
  const b = fixtureBundle();
  const pack = fixturePack();

  const scored = (score: number | null, confidence = 1) => ({ score, confidence, weight: 1, spread: 0, topics: 1, family: 'political' });

  it('offers a map view only once both its spectrums are scored', () => {
    const pairs = [['social', 'civil']] as const;
    expect(mapViews(b, { social: scored(-0.5), civil: scored(null) } as Profile['axes'], pairs)).toEqual([]);
    expect(mapViews(b, { social: scored(-0.5, 0.6), civil: scored(0.2) } as Profile['axes'], pairs)).toEqual([
      {
        id: 'social-civil',
        x: { id: 'social', title: 'Social', poles: ['Tradition', 'Progress'], score: -0.5, confidence: 0.6 },
        y: { id: 'civil', title: 'Civil', poles: ['Liberty', 'Authority'], score: 0.2, confidence: 1 },
      },
    ]);
  });

  it('ranks the listed traditions in list order, with their closeness, and places every one', () => {
    const traditions = mapTraditions(pack, [
      { id: 'moderates', band: 'Very close' },
      { id: 'reformers', band: 'Close' },
    ]);
    expect(traditions.map((t) => [t.id, t.rank, t.band, t.positions.social, t.positions.civil])).toEqual([
      ['reformers', 1, 'Close', 0.7, -0.35],
      ['planners', null, null, 0.5, 0.65],
      ['keepers', null, null, -0.7, 0.35],
      ['marketeers', null, null, -0.4, -0.65],
      ['moderates', 0, 'Very close', 0.15, 0],
    ]);
  });

  it('compares the answers with a tradition spectrum by spectrum, leaving out what is missing or split', () => {
    const keepers = pack.traditions.find((t) => t.id === 'keepers')!;
    const scores = { social: scored(-0.4), civil: scored(null) } as Profile['axes'];
    expect(compareWith(b, scores, keepers)).toEqual([
      { axis: 'social', title: 'Social', poles: ['Tradition', 'Progress'], you: -0.4, them: -0.7 },
      { axis: 'civil', title: 'Civil', poles: ['Liberty', 'Authority'], you: null, them: 0.35 },
    ]);
    expect(compareWith(b, scores, { ...keepers, divided: ['civil'] }).map((c) => c.them)).toEqual([-0.7, null]);
  });

  it('lists the user, then each tradition by name, in words', () => {
    const log = new Log();
    log.add('alpha.stance', scale(1));
    const s = buildAnswerState(b, log.events);
    const profile = buildProfile(s, { appVersion: 't', now: 'x', includeSensitive: false, resolutions: [] });
    const words = { you: 'You', divided: 'Divided', none: 'Not enough answers' };
    const table = traditionTable(b, pack, profile, words);
    expect(table.columns).toEqual([
      { id: 'social', title: 'Social' },
      { id: 'civil', title: 'Civil' },
    ]);
    expect(table.rows.map((r) => [r.name, ...r.cells])).toEqual([
      ['You', 'Strongly Tradition', 'Not enough answers'],
      ['Free exchange', 'Tradition', 'Liberty'],
      ['Keeping', 'Strongly Tradition', 'Leans Authority'],
      ['Moderation', 'Leans Progress', 'Center'],
      ['Planning', 'Progress', 'Authority'],
      ['Reform', 'Strongly Progress', 'Leans Liberty'],
    ]);
  });
});
