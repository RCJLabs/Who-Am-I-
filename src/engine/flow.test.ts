import { describe, expect, it } from 'vitest';
import type { Response, Via } from '../model/answers.ts';
import { fixtureBundle, Log, multi, pick, scale, skip } from '../../tests/helpers.ts';
import { nextStep, pendingRevise, progress, type FlowOptions, type Step } from './flow.ts';
import { buildAnswerState } from './state.ts';

const b = fixtureBundle();

/** Answers whatever the flow asks next, asserting what it asks. */
class Walk {
  log = new Log();
  private topic: string;
  private opts: FlowOptions;
  constructor(topic: string, opts: FlowOptions = {}) {
    this.topic = topic;
    this.opts = opts;
  }
  step(): Step {
    return nextStep(buildAnswerState(b, this.log.events), this.topic, this.opts);
  }
  expectItem(key: string, r: Response): this {
    const st = this.step();
    expect(st.kind === 'item' ? st.item.key : `${st.kind}:${'item' in st ? st.item.key : ''}`).toBe(key);
    this.log.add(`${this.topic}.${key}`, r);
    return this;
  }
  expectReask(key: string, via: Via, previousStep: number | null, r: Response): this {
    const st = this.step();
    expect(st.kind).toBe('reask');
    if (st.kind !== 'reask') return this;
    expect(st.item.key).toBe(key);
    expect(st.via).toEqual(via);
    const prev = st.previous?.r;
    expect(prev?.kind === 'scale' ? prev.step : null).toBe(previousStep);
    this.log.add(st.item.id, r, st.via);
    return this;
  }
  expectDone(): this {
    expect(this.step()).toEqual({ kind: 'done' });
    return this;
  }
}

describe('nextStep', () => {
  it('walks a restrictive answer through a revise, then challenges the new side, then re-asks', () => {
    new Walk('alpha')
      .expectItem('stance', scale(2))
      .expectItem('importance', scale(4))
      .expectItem('circ', scale(5))
      .expectItem('circ_deep', scale(1))
      .expectItem('anchor_auto', scale(7)) // limit skipped: stance < 0
      .expectItem('anchor_life', scale(1))
      .expectItem('ch_con', pick('rethink'))
      .expectReask('stance', { kind: 'challenge', source: 'alpha.ch_con' }, 2, scale(6))
      .expectItem('limit', pick('any')) // revealed by the new stance
      .expectItem('ch_pro', pick('hold')) // the new side gets challenged too
      .expectItem('ch_limit', pick('hold'))
      .expectItem('ch_deep', pick('hold'))
      .expectReask('stance', { kind: 'reask', source: 'alpha.check' }, 6, scale(6))
      .expectDone();
  });

  it('asks the consistency challenge only for the exception pattern', () => {
    const w = new Walk('alpha')
      .expectItem('stance', scale(1))
      .expectItem('importance', scale(4))
      .expectItem('circ', scale(4))
      .expectItem('circ_deep', scale(3))
      .expectItem('anchor_auto', scale(4))
      .expectItem('anchor_life', scale(4))
      .expectItem('ch_con', pick('hold'))
      .expectItem('ch_circ', pick('drop'));
    w.expectReask('circ', { kind: 'challenge', source: 'alpha.ch_circ' }, 4, scale(2))
      .expectReask('stance', { kind: 'reask', source: 'alpha.check' }, 1, scale(1))
      .expectDone();
  });

  it('skips deep items when the topic matters little, and asks them with alwaysDeep', () => {
    const answer = (opts: FlowOptions) =>
      new Walk('alpha', opts)
        .expectItem('stance', scale(6))
        .expectItem('importance', scale(1))
        .expectItem('circ', scale(3));
    answer({}).expectItem('limit', pick('some'));
    answer({ alwaysDeep: true }).expectItem('circ_deep', scale(3));
  });

  it('hides challenges and the re-ask when the stance is skipped', () => {
    new Walk('alpha')
      .expectItem('stance', skip)
      .expectItem('importance', scale(4))
      .expectItem('circ', scale(3))
      .expectItem('circ_deep', scale(3))
      .expectItem('anchor_auto', scale(4))
      .expectItem('anchor_life', scale(4))
      .expectDone();
  });

  it('asks the middle challenge for a middle stance', () => {
    new Walk('beta')
      .expectItem('stance', scale(4))
      .expectItem('importance', scale(2))
      .expectItem('anchor_auto', scale(4))
      .expectItem('anchor_life', scale(4))
      .expectItem('ch_mid', pick('abstain'))
      .expectReask('stance', { kind: 'reask', source: 'beta.check' }, 4, scale(4))
      .expectDone();
  });

  it('resumes a pending revise after a reload, and clears it on any later answer to the target', () => {
    const log = new Log();
    log.add('beta.stance', scale(2));
    log.add('beta.importance', scale(3));
    log.add('beta.anchor_auto', scale(3));
    log.add('beta.anchor_life', scale(3));
    log.add('beta.ch_con', pick('rethink'));
    const topic = b.topics.find((t) => t.id === 'beta')!;
    expect(pendingRevise(buildAnswerState(b, log.events), topic)?.target.id).toBe('beta.stance');
    log.add('beta.stance', scale(3), { kind: 'manual' });
    expect(pendingRevise(buildAnswerState(b, log.events), topic)).toBeNull();
  });

  it("doesn't re-ask a revise target that is now hidden", () => {
    const log = new Log();
    log.add('alpha.stance', scale(6));
    log.add('alpha.limit', pick('any'));
    log.add('alpha.ch_limit', pick('rethink'));
    log.add('alpha.stance', scale(2), { kind: 'manual' });
    const topic = b.topics.find((t) => t.id === 'alpha')!;
    expect(pendingRevise(buildAnswerState(b, log.events), topic)).toBeNull();
  });

  it('offers the top-ranked tension for this topic once items are done', () => {
    const w = new Walk('beta', {
      tensions: [
        { key: 'low', topics: ['alpha', 'beta'], rank: 1 },
        { key: 'high', topics: ['beta', 'gamma'], rank: 2 },
        { key: 'other', topics: ['alpha', 'gamma'], rank: 9 },
      ],
    });
    w.expectItem('stance', skip).expectItem('importance', skip).expectItem('anchor_auto', scale(1)).expectItem('anchor_life', scale(1));
    expect(w.step()).toEqual({ kind: 'tension', key: 'high' });
  });

  it('shows items conditioned on multi-select picks', () => {
    new Walk('tunes').expectItem('genres', multi({ rock: 3 })).expectItem('discovery', scale(3));
    new Walk('tunes').expectItem('genres', multi({ jazz: 5 })).expectItem('jazz_era', pick('bebop'));
  });
});

describe('progress', () => {
  it('counts answered and possibly-remaining items', () => {
    const log = new Log();
    let p = progress(buildAnswerState(b, log.events), 'beta');
    expect(p).toEqual({ answered: 0, remaining: 7, complete: false });
    log.add('beta.stance', scale(7));
    log.add('beta.importance', scale(4));
    p = progress(buildAnswerState(b, log.events), 'beta');
    expect(p).toEqual({ answered: 2, remaining: 3, complete: false }); // 2 anchors + ch_pro
    for (const [id, r] of [['beta.anchor_auto', scale(4)], ['beta.anchor_life', scale(4)], ['beta.ch_pro', pick('hold')], ['beta.stance', scale(7)]] as const) {
      log.add(id, r, id === 'beta.stance' ? { kind: 'reask', source: 'beta.check' } : undefined);
    }
    expect(progress(buildAnswerState(b, log.events), 'beta')).toEqual({ answered: 5, remaining: 0, complete: true });
  });
});
