// Observations → scores with evidence thresholds. Confidence measures evidence, not completion:
// it never drops when new content is added.
import type { Bundle, Target } from '../model/content.ts';
import type { Observation } from './observe.ts';

export interface EvidenceRule {
  minWeight: number;
  fullWeight: number;
  minTopics: number;
}

export interface Scored {
  /** -1..1, or null when there isn't enough evidence. */
  score: number | null;
  confidence: number;
  weight: number;
  spread: number;
  topics: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function evidenceRule(bundle: Bundle, target: Target): EvidenceRule {
  if (target.startsWith('axis:')) {
    const axis = bundle.axes[target.slice(5)];
    if (axis) return { minWeight: axis.minWeight, fullWeight: axis.fullWeight, minTopics: axis.minTopics };
  }
  return bundle.config.principleDefaults;
}

export function scoreObservations(obs: readonly Observation[], rule: (t: Target) => EvidenceRule): Map<Target, Scored> {
  const groups = new Map<Target, Observation[]>();
  for (const o of obs) {
    const g = groups.get(o.target);
    if (g) g.push(o);
    else groups.set(o.target, [o]);
  }
  const out = new Map<Target, Scored>();
  for (const [target, list] of groups) out.set(target, scoreGroup(list, rule(target)));
  return out;
}

export function scoreGroup(list: readonly Observation[], rule: EvidenceRule): Scored {
  let weight = 0;
  let sum = 0;
  for (const o of list) {
    weight += o.w;
    sum += o.w * o.x;
  }
  const topics = new Set(list.map((o) => o.topic)).size;
  const mean = weight > 0 ? sum / weight : 0;
  let variance = 0;
  for (const o of list) variance += o.w * (o.x - mean) ** 2;
  const spread = weight > 0 ? Math.sqrt(variance / weight) : 0;
  const enough = weight > 0 && weight >= rule.minWeight - 1e-9 && topics >= rule.minTopics;
  return {
    score: enough ? Math.max(-1, Math.min(1, mean)) : null,
    confidence: clamp01(weight / rule.fullWeight) * clamp01(topics / rule.minTopics),
    weight,
    spread,
    topics,
  };
}

/** "Mixed": answers pull both ways and roughly cancel out. */
export function isMixed(s: Scored, bundle: Bundle): boolean {
  return s.score !== null && s.spread > bundle.config.display.mixedSpread && Math.abs(s.score) < bundle.config.display.mixedScore;
}
