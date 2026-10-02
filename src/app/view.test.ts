import { describe, expect, it } from 'vitest';
import type { Item } from '../model/content.ts';
import { buildAnswerState } from '../engine/state.ts';
import { fixtureBundle, Log, multi, pick, scale, skip } from '../../tests/helpers.ts';
import { parseHash, to } from './routes.ts';
import { activeTopic, answerLabel, axisFeeders, nextTopic, orderedOptions, sources, toFivePoint, toPercent, topicStatus } from './view.ts';

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
    ['#/settings', { name: 'settings' }],
    ['#/nope', { name: 'not-found', path: '/nope' }],
  ])('parses %j', (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it('round-trips hrefs', () => {
    expect(parseHash(to.flow('vaccine_mandates', 'anchor_ba'))).toEqual({ name: 'flow', topic: 'vaccine_mandates', edit: 'anchor_ba' });
    expect(parseHash(to.tension('bodily_autonomy|abortion|vaccine_mandates'))).toEqual({ name: 'tension', key: 'bodily_autonomy|abortion|vaccine_mandates' });
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
    expect(nextTopic(b, s, 'beta')?.id).toBe('gamma');
    expect(nextTopic(b, s)?.id).toBe('alpha');
    for (const id of ['beta.importance', 'beta.anchor_auto', 'beta.anchor_life']) log.add(id, skip);
    log.add('beta.ch_mid', pick('abstain'));
    log.add('beta.stance', scale(4), { kind: 'reask', source: 'beta.check' });
    s = buildAnswerState(b, log.events);
    expect(topicStatus(s, topic('beta')).complete).toBe(true);
    expect(activeTopic(s)).toBeNull();
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
