// Cross-topic tensions: the same principle endorsed very differently in two topics, measured only
// on anchor items (matched-wording, single-principle probes). Inconsistency within one topic is
// the job of authored challenges, never of this detector.
import type { TensionResolution } from '../model/answers.ts';
import type { PrincipleId, TopicId } from '../model/content.ts';
import { importance01 } from './flow.ts';
import { observe, type Observation } from './observe.ts';
import type { AnswerState } from './state.ts';

export interface AnchorSide {
  topic: TopicId;
  /** Endorsement of the principle in this topic, -1..1. */
  e: number;
  w: number;
  items: string[];
  events: string[];
  context: string;
  against?: string;
}

export interface Tension {
  /** principle|topicA|topicB, topic ids sorted. */
  key: string;
  principle: PrincipleId;
  gap: number;
  rank: number;
  /** Sides ordered by topic id (a < b). */
  a: AnchorSide;
  b: AnchorSide;
  /** Anchor events the tension is based on; a resolution only holds while these are unchanged. */
  basis: string[];
  status: 'open' | 'resolved';
  resolution?: TensionResolution;
}

export function tensionKey(principle: PrincipleId, t1: TopicId, t2: TopicId): string {
  return [principle, ...[t1, t2].sort()].join('|');
}

export function anchorTable(s: AnswerState, obs: readonly Observation[]): Map<PrincipleId, Map<TopicId, AnchorSide>> {
  const acc = new Map<PrincipleId, Map<TopicId, { sum: number; w: number; items: Set<string>; events: Set<string> }>>();
  for (const o of obs) {
    if (!o.anchor) continue;
    const p = o.target.slice('principle:'.length);
    if (!acc.has(p)) acc.set(p, new Map());
    const byTopic = acc.get(p)!;
    const cur = byTopic.get(o.topic) ?? { sum: 0, w: 0, items: new Set<string>(), events: new Set<string>() };
    cur.sum += o.w * o.x;
    cur.w += o.w;
    cur.items.add(o.item);
    cur.events.add(o.event);
    byTopic.set(o.topic, cur);
  }
  const out = new Map<PrincipleId, Map<TopicId, AnchorSide>>();
  for (const [p, byTopic] of acc) {
    const sides = new Map<TopicId, AnchorSide>();
    for (const [topic, cur] of byTopic) {
      const firstItem = s.ix.items.get([...cur.items][0]!)!;
      const side: AnchorSide = {
        topic,
        e: cur.sum / cur.w,
        w: cur.w,
        items: [...cur.items].sort(),
        events: [...cur.events].sort(),
        context: firstItem.anchor?.context ?? topic,
      };
      if (firstItem.anchor?.against) side.against = firstItem.anchor.against;
      sides.set(topic, side);
    }
    out.set(p, sides);
  }
  return out;
}

export function detectTensions(s: AnswerState, obs: readonly Observation[], resolutions: readonly TensionResolution[]): Tension[] {
  const { minGap, minAnchorWeight } = s.ix.bundle.config.tension;
  const latestResolution = new Map<string, TensionResolution>();
  for (const r of [...resolutions].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))) latestResolution.set(r.key, r);

  const out: Tension[] = [];
  for (const [principle, sides] of anchorTable(s, obs)) {
    const eligible = [...sides.values()].filter((x) => x.w >= minAnchorWeight - 1e-9).sort((x, y) => x.topic.localeCompare(y.topic));
    for (let i = 0; i < eligible.length; i++) {
      for (let j = i + 1; j < eligible.length; j++) {
        const a = eligible[i]!;
        const b = eligible[j]!;
        const gap = Math.abs(a.e - b.e);
        if (gap < minGap - 1e-9) continue;
        const imp = (t: TopicId) => importance01(s, s.ix.topics.get(t)!) ?? 0.5;
        const key = tensionKey(principle, a.topic, b.topic);
        const basis = [...a.events, ...b.events].sort();
        const res = latestResolution.get(key);
        const current = res !== undefined && sameSet(res.basis, basis);
        const t: Tension = {
          key,
          principle,
          gap,
          rank: gap * (0.5 + 0.5 * Math.min(imp(a.topic), imp(b.topic))),
          a,
          b,
          basis,
          status: current ? 'resolved' : 'open',
        };
        if (current) t.resolution = res;
        out.push(t);
      }
    }
  }
  return out.sort((x, y) => y.rank - x.rank || x.key.localeCompare(y.key));
}

/** Open tensions computed over everything the user answered (private, on-device view). */
export function openTensions(s: AnswerState, resolutions: readonly TensionResolution[]): Tension[] {
  return detectTensions(s, observe(s, { includeSensitive: true }), resolutions).filter((t) => t.status === 'open');
}

/** 1 = principle applied the same way across topics (anchors only); null with < 2 topics. */
export function principleConsistency(s: AnswerState, obs: readonly Observation[]): Map<PrincipleId, number | null> {
  const { minAnchorWeight } = s.ix.bundle.config.tension;
  const out = new Map<PrincipleId, number | null>();
  for (const [p, sides] of anchorTable(s, obs)) {
    const es = [...sides.values()].filter((x) => x.w >= minAnchorWeight - 1e-9).map((x) => x.e);
    out.set(p, es.length < 2 ? null : 1 - (Math.max(...es) - Math.min(...es)) / 2);
  }
  return out;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((x, i) => x === sb[i]);
}
