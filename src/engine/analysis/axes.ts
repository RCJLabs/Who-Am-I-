// Spectrum and principle results as facts, with what pulled each spectrum which way.
import type { AxisFamily, Bundle, TopicId } from '../../model/content.ts';
import type { Profile } from '../../model/profile.ts';
import type { Observation } from '../observe.ts';
import { isMixed } from '../score.ts';
import { HIGH_CONFIDENCE, LOW_CONFIDENCE } from './constants.ts';
import type { AxisFact, Driver, Level, PrincipleFact } from './types.ts';

export function level(confidence: number): Level {
  return confidence >= HIGH_CONFIDENCE ? 'high' : confidence >= LOW_CONFIDENCE ? 'medium' : 'low';
}

const emptyFamilies = (): Record<AxisFamily, AxisFact[]> => ({ political: [], personality: [], values: [], thinking: [], worldview: [], taste: [] });

/** Scored spectrums by family, in content order. `obs` must match the profile's scope. */
export function axisFacts(b: Bundle, profile: Profile, obs: readonly Observation[]): Record<AxisFamily, AxisFact[]> {
  const out = emptyFamilies();
  for (const a of Object.values(b.axes)) {
    const r = profile.axes[a.id];
    if (!r || r.score === null) continue;
    out[a.family].push({
      axis: a.id,
      family: a.family,
      score: r.score,
      confidence: r.confidence,
      level: level(r.confidence),
      spread: r.spread,
      topics: r.topics,
      mixed: isMixed(r, b),
      drivers: drivers(obs, `axis:${a.id}`),
    });
  }
  return out;
}

/**
 * Each topic's mean position on a target, split by direction: [toward the negative pole, toward
 * the positive pole], each with the strongest pull (|x| × weight) first.
 */
export function drivers(obs: readonly Observation[], target: string): [Driver[], Driver[]] {
  const acc = new Map<TopicId, { sum: number; w: number }>();
  for (const o of obs) {
    if (o.target !== target) continue;
    const cur = acc.get(o.topic) ?? { sum: 0, w: 0 };
    cur.sum += o.w * o.x;
    cur.w += o.w;
    acc.set(o.topic, cur);
  }
  const all: Driver[] = [...acc].map(([topic, { sum, w }]) => ({ topic, x: sum / w, w }));
  const pull = (d: Driver) => Math.abs(d.x) * d.w;
  const toward = (negative: boolean) =>
    all.filter((d) => (negative ? d.x < 0 : d.x > 0)).sort((p, q) => pull(q) - pull(p) || (p.topic < q.topic ? -1 : 1));
  return [toward(true), toward(false)];
}

/** Scored principles, in content order. */
export function principleFacts(b: Bundle, profile: Profile): PrincipleFact[] {
  return Object.values(b.principles).flatMap((p) => {
    const r = profile.principles[p.id];
    if (!r || r.score === null) return [];
    return [{ principle: p.id, score: r.score, confidence: r.confidence, level: level(r.confidence), topics: r.topics, consistency: r.consistency }];
  });
}
