// Simulated respondent strategies.
import type { Response } from '../../src/model/answers.ts';
import type { Item, Target } from '../../src/model/content.ts';
import { scalePoints, isScale } from '../../src/model/content.ts';
import { valueStep } from '../../src/engine/normalize.ts';
import type { Policy, PolicyCtx } from './harness.ts';

const SKIP: Response = { kind: 'skip' };

/** Uniformly random answers, with an occasional skip / unsure. */
export function randomPolicy(opts: { skipRate?: number } = {}): Policy {
  const skipRate = opts.skipRate ?? 0.1;
  return ({ item, rng }) => {
    if (rng() < skipRate) return item.unsure && rng() < 0.5 ? { kind: 'unsure' } : SKIP;
    return randomAnswer(item, rng);
  };
}

export function randomAnswer(item: Item, rng: () => number): Response {
  const pickOne = <T>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;
  if (isScale(item)) return { kind: 'scale', step: 1 + Math.floor(rng() * scalePoints(item)) };
  switch (item.type) {
    case 'choice':
    case 'challenge':
      return { kind: 'option', option: pickOne(item.options).id };
    case 'pair':
      return item.strength
        ? { kind: 'option', option: pickOne(item.options).id, strength: rng() < 0.5 ? 1 : 2 }
        : { kind: 'option', option: pickOne(item.options).id };
    case 'multi': {
      const picks: Record<string, number | true> = {};
      for (const o of item.options) {
        if (item.max !== undefined && Object.keys(picks).length >= item.max) break;
        if (rng() < 0.4) picks[o.id] = item.intensity ? 1 + Math.floor(rng() * 5) : true;
      }
      return { kind: 'multi', picks };
    }
    default:
      return SKIP;
  }
}

/** Agrees (or disagrees) with every agree/disagree statement and skips everything else. */
export function constantPolicy(dir: 'agree' | 'disagree'): Policy {
  return ({ item }) => {
    if (item.type !== 'likert' || item.labels[0] !== 'Strongly disagree') return SKIP;
    return { kind: 'scale', step: dir === 'agree' ? item.points : 1 };
  };
}

export type Reactions = 'hold' | 'yield';

/**
 * Answers from the content's own weights toward target positions. Only tests the pipeline: it
 * uses the same signs as the scorer, so it can't catch keying mistakes (personas do that).
 */
export function ideologyPolicy(positions: Partial<Record<Target, number>>, reactions: Reactions = 'hold'): Policy {
  return (ctx: PolicyCtx) => {
    const { item, step } = ctx;
    if (step.kind === 'reask') {
      const prev = step.previous?.r;
      if (reactions === 'hold' || !prev || prev.kind !== 'scale') return prev ?? SKIP;
      const n = isScale(item) ? scalePoints(item) : 7;
      const mid = (n + 1) / 2;
      return { kind: 'scale', step: prev.step === mid ? prev.step : prev.step + (prev.step < mid ? 1 : -1) };
    }
    if (item.type === 'importance') return { kind: 'scale', step: 4 };
    if (item.type === 'challenge') {
      const want = reactions === 'hold' ? item.options.find((o) => o.reaction !== 'yield') : item.options.find((o) => o.reaction === 'yield' && o.revise);
      return { kind: 'option', option: (want ?? item.options[0]!).id };
    }
    if (item.type === 'likert' || item.type === 'slider' || item.type === 'rating') {
      let num = 0;
      let den = 0;
      for (const e of item.effects) {
        const pos = positions[e.target];
        if (pos === undefined) continue;
        num += e.w * pos;
        den += Math.abs(e.w);
      }
      if (den === 0) return SKIP;
      return { kind: 'scale', step: valueStep(num / den, scalePoints(item)) };
    }
    if (item.type === 'choice' || item.type === 'pair') {
      let best = item.options[0]!;
      let bestScore = -Infinity;
      for (const o of item.options) {
        let sc = 0;
        for (const e of o.effects) sc += (positions[e.target] ?? 0) * e.v;
        if (item.type === 'choice' && o.value !== undefined) for (const e of item.effects) sc += (positions[e.target] ?? 0) * Math.sign(e.w) * o.value;
        if (sc > bestScore) {
          best = o;
          bestScore = sc;
        }
      }
      return { kind: 'option', option: best.id };
    }
    return SKIP;
  };
}

/**
 * Fixed answers by item id; anything else goes to the fallback (or fails loudly).
 * Re-asks use "<item id>@reask" if scripted, otherwise keep the previous answer.
 */
export function scriptedPolicy(answers: Record<string, Response>, fallback?: Policy): Policy {
  return (ctx) => {
    if (ctx.step.kind === 'reask') {
      const again = answers[`${ctx.item.id}@reask`];
      if (again) return again;
      if (ctx.step.previous) return ctx.step.previous.r;
    }
    const r = answers[ctx.item.id];
    if (r) return r;
    if (fallback) return fallback(ctx);
    throw new Error(`no scripted answer for ${ctx.item.id}`);
  };
}
