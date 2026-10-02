import { describe, expect, it } from 'vitest';
import type { Item, PairItem } from '../model/content.ts';
import { fixtureBundle, Log, multi, pick, scale, skip, unsure } from '../../tests/helpers.ts';
import { resolve, stepValue, valueStep } from './normalize.ts';
import { observe } from './observe.ts';
import { evidenceRule, isMixed, scoreObservations } from './score.ts';
import { buildAnswerState } from './state.ts';

const b = fixtureBundle();
const item = (id: string): Item => b.topics.flatMap((t) => t.items).find((i) => i.id === id)!;

function scores(log: Log, includeSensitive = true) {
  const s = buildAnswerState(b, log.events);
  return scoreObservations(observe(s, { includeSensitive }), (t) => evidenceRule(b, t));
}

describe('normalize', () => {
  it('maps steps to [-1, 1] for every scale size', () => {
    expect([1, 2, 3, 4].map((k) => stepValue(k, 4))).toEqual([-1, -1 / 3, 1 / 3, 1]);
    expect([1, 3, 5].map((k) => stepValue(k, 5))).toEqual([-1, 0, 1]);
    expect([1, 4, 5, 7].map((k) => stepValue(k, 7))).toEqual([-1, 0, 1 / 3, 1]);
    expect(stepValue(6, 11)).toBe(0);
    for (const n of [4, 5, 7, 11]) for (let k = 1; k <= n; k++) expect(valueStep(stepValue(k, n), n)).toBe(k);
  });

  it('resolves responses and rejects ones that no longer fit', () => {
    expect(resolve(item('alpha.stance'), scale(7))).toEqual({ kind: 'scale', v: 1, step: 7 });
    expect(resolve(item('alpha.stance'), scale(8))).toBe('invalid');
    expect(resolve(item('alpha.stance'), pick('x'))).toBe('invalid');
    expect(resolve(item('alpha.stance'), skip)).toBeNull();
    expect(resolve(item('alpha.limit'), pick('any'))).toEqual({ kind: 'option', option: 'any', v: 1 });
    expect(resolve(item('alpha.limit'), pick('gone'))).toBe('invalid');
    expect(resolve(item('alpha.check'), scale(1))).toBe('invalid');
  });

  it('maps multi-select intensity to 0..1 and enforces options', () => {
    const r = resolve(item('tunes.genres'), multi({ jazz: 5, rock: 1, pop: true }));
    expect(r !== null && r !== 'invalid' && r.kind === 'multi' && Object.fromEntries(r.picks)).toEqual({ jazz: 1, rock: 0.2, pop: 1 });
    expect(resolve(item('tunes.genres'), multi({ polka: 3 }))).toBe('invalid');
  });

  it('scales pair positions by strength', () => {
    const pair: PairItem = {
      id: 't.p', key: 'p', topic: 't', text: 'P', tags: [], deep: false, sticky: false, unsure: true, sensitive: false,
      type: 'pair', strength: true, weight: 1,
      options: [{ id: 'a', label: 'A', value: -1, effects: [] }, { id: 'b', label: 'B', value: 1, effects: [] }],
    };
    expect(resolve(pair, pick('b', 1))).toEqual({ kind: 'option', option: 'b', strength: 1, v: 0.5 });
    expect(resolve(pair, pick('a'))).toEqual({ kind: 'option', option: 'a', strength: 2, v: -1 });
  });
});

describe('answer state', () => {
  it('keeps the latest answer per item and orders by event id', () => {
    const log = new Log();
    log.add('alpha.stance', scale(2));
    log.add('alpha.stance', scale(6));
    const s = buildAnswerState(b, [...log.events].reverse());
    expect(s.values.get('alpha.stance')).toMatchObject({ step: 6 });
    expect(s.history.get('alpha.stance')!.map((e) => e.id)).toEqual(['e000001', 'e000002']);
  });

  it('orphans unknown items and restarts an item whose latest answer no longer fits', () => {
    const log = new Log();
    log.add('gone.item', scale(3));
    log.add('alpha.circ', scale(2));
    log.add('alpha.circ', scale(9));
    const s = buildAnswerState(b, log.events);
    expect(s.orphans.map((e) => e.id)).toEqual(['e000001', 'e000002', 'e000003']);
    expect(s.latest.has('alpha.circ')).toBe(false);
    expect(s.values.has('alpha.circ')).toBe(false);
  });

  it('records visits without values for skip and unsure', () => {
    const log = new Log();
    log.add('alpha.stance', skip);
    log.add('alpha.circ', unsure);
    const s = buildAnswerState(b, log.events);
    expect(s.latest.has('alpha.stance')).toBe(true);
    expect(s.values.has('alpha.stance')).toBe(false);
    expect(s.visible.get('alpha.limit')).toBe(false); // stance unknown → limit not shown
  });

  it('computes visibility in order and hides answers from conditions when their item is hidden', () => {
    const log = new Log();
    log.add('alpha.stance', scale(6));
    log.add('alpha.limit', pick('any'));
    let s = buildAnswerState(b, log.events);
    expect(s.visible.get('alpha.limit')).toBe(true);
    expect(s.visible.get('alpha.ch_limit')).toBe(true);
    log.add('alpha.stance', scale(2));
    s = buildAnswerState(b, log.events);
    expect(s.visible.get('alpha.limit')).toBe(false);
    expect(s.live.has('alpha.limit')).toBe(false);
    expect(s.values.has('alpha.limit')).toBe(true);
    expect(s.visible.get('alpha.ch_limit')).toBe(false);
  });
});

describe('observe and score', () => {
  it('computes weighted means, spread and confidence (hand-checked)', () => {
    const log = new Log();
    log.add('alpha.stance', scale(7)); // x=1, w=1
    log.add('alpha.circ', scale(1)); // x=-1, w=0.5
    const social = scores(log).get('axis:social')!;
    expect(social.score).toBeCloseTo(1 / 3, 10);
    expect(social.weight).toBe(1.5);
    expect(social.spread).toBeCloseTo(Math.sqrt(8 / 9), 10);
    expect(social.confidence).toBeCloseTo(1.5 / 4, 10);
    expect(social.topics).toBe(1);
  });

  it('applies reverse keying and the minimum-evidence rule', () => {
    const log = new Log();
    log.add('traits.t1', scale(5)); // +1
    log.add('traits.t2', scale(1)); // reverse-keyed: +1
    let warmth = scores(log).get('axis:warmth')!;
    expect(warmth.score).toBeNull(); // weight 2 < minWeight 3
    log.add('traits.t3', scale(4)); // +0.5
    log.add('traits.t4', skip);
    warmth = scores(log).get('axis:warmth')!;
    expect(warmth.score).toBeCloseTo(2.5 / 3, 10);
    expect(warmth.confidence).toBeCloseTo(0.75, 10);
  });

  it('uses option values for item-level effects on choices', () => {
    const log = new Log();
    log.add('alpha.stance', scale(4)); // x=0, w=1
    log.add('alpha.limit', pick('any')); // value 1 → x=1, w=0.5
    expect(scores(log).get('axis:social')!.score).toBeCloseTo(0.5 / 1.5, 10);
  });

  it('lets hidden answers go dormant, except sticky challenges', () => {
    const log = new Log();
    log.add('alpha.stance', scale(7));
    log.add('alpha.limit', pick('any'));
    log.add('alpha.ch_pro', pick('hold')); // autonomy +1
    log.add('alpha.stance', scale(1), { kind: 'manual' });
    const s = buildAnswerState(b, log.events);
    const obs = observe(s, { includeSensitive: true });
    expect(obs.some((o) => o.item === 'alpha.limit')).toBe(false);
    expect(obs.find((o) => o.item === 'alpha.ch_pro')).toMatchObject({ target: 'principle:autonomy', x: 1, w: 1 });
    expect(scoreObservations(obs, (t) => evidenceRule(b, t)).get('axis:social')!.score).toBe(-1);
  });

  it('excludes sensitive answers when asked to', () => {
    const log = new Log();
    log.add('alpha.stance', scale(1));
    log.add('gamma.belief', scale(5));
    expect(scores(log, true).get('axis:social')!.score).toBe(0);
    expect(scores(log, false).get('axis:social')!.score).toBe(-1);
  });

  it('flags anchor observations only on the anchor principle', () => {
    const log = new Log();
    log.add('alpha.anchor_auto', scale(7));
    log.add('alpha.ch_con', pick('rethink'));
    const obs = observe(buildAnswerState(b, log.events), { includeSensitive: true });
    expect(obs.find((o) => o.item === 'alpha.anchor_auto')).toMatchObject({ anchor: true, target: 'principle:autonomy', x: 1 });
  });

  it('labels evidence that cancels out as mixed', () => {
    const log = new Log();
    log.add('alpha.stance', scale(7));
    log.add('alpha.circ', scale(1));
    log.add('alpha.circ_deep', scale(1));
    const social = scores(log).get('axis:social')!;
    expect(social.score).toBe(0);
    expect(isMixed(social, b)).toBe(true);
  });
});
