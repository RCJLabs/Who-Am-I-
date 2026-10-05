// Assembles the versioned Profile (the public contract for the game and other consumers).
// With includeSensitive: false everything is recomputed from non-sensitive answers, so sensitive
// answers can't leak through derived scores.
import type { TensionResolution } from '../model/answers.ts';
import { IDENTITY_DOMAIN, type Bundle, type Item, type Topic } from '../model/content.ts';
import type { Profile, Scored as ScoredOut, TopicResult } from '../model/profile.ts';
import { importance01, progress } from './flow.ts';
import { observe, type Observation } from './observe.ts';
import { evidenceRule, scoreObservations, type Scored } from './score.ts';
import { challengeSummary, itemHistory } from './shifts.ts';
import type { AnswerState } from './state.ts';
import { detectTensions, principleConsistency } from './tensions.ts';

export interface ProfileOptions {
  includeSensitive: boolean;
  appVersion: string;
  /** ISO timestamp (injected so builds are deterministic). */
  now: string;
  resolutions: readonly TensionResolution[];
}

const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;
const EMPTY: Scored = { score: null, confidence: 0, weight: 0, spread: 0, topics: 0 };

function out(sc: Scored | undefined): ScoredOut {
  const v = sc ?? EMPTY;
  return { score: v.score === null ? null : r4(v.score), confidence: r4(v.confidence), weight: r4(v.weight), spread: r4(v.spread), topics: v.topics };
}

function weightedMean(list: readonly Observation[]): number {
  let w = 0;
  let sum = 0;
  for (const o of list) {
    w += o.w;
    sum += o.w * o.x;
  }
  return w > 0 ? sum / w : 0;
}

export function buildProfile(s: AnswerState, o: ProfileOptions): Profile {
  const b = s.ix.bundle;
  const included = (t: Topic): boolean => o.includeSensitive || !t.sensitive;
  // Items can be sensitive inside a topic that isn't (e.g. the moral question on smacking).
  const shown = (it: Item): boolean => o.includeSensitive || !it.sensitive;
  const answered = (t: Topic): boolean => t.items.some((i) => s.latest.has(i.id));
  const topics = b.topics.filter((t) => included(t) && answered(t));

  const obs = observe(s, { includeSensitive: o.includeSensitive });
  const scored = scoreObservations(obs, (t) => evidenceRule(b, t));
  const consistency = principleConsistency(s, obs);

  const axes: Profile['axes'] = {};
  for (const a of Object.values(b.axes)) axes[a.id] = { ...out(scored.get(`axis:${a.id}`)), family: a.family };

  const principles: Profile['principles'] = {};
  for (const p of Object.values(b.principles)) {
    const target = `principle:${p.id}`;
    const byTopic: Record<string, number> = {};
    for (const t of topics) {
      const list = obs.filter((x) => x.target === target && x.topic === t.id);
      if (list.length) byTopic[t.id] = r4(weightedMean(list));
    }
    const c = consistency.get(p.id);
    principles[p.id] = { ...out(scored.get(`principle:${p.id}`)), byTopic, consistency: c === undefined || c === null ? null : r4(c) };
  }

  const topicResults: Profile['topics'] = {};
  const interests: Profile['interests'] = {};
  const identity: Record<string, string | string[]> = {};
  let answeredCount = 0;

  for (const t of topics) {
    for (const it of t.items) if (shown(it) && s.values.has(it.id)) answeredCount++;

    const stanceItem = t.stance ? s.ix.items.get(t.stance) : undefined;
    const stanceHist = t.stance ? itemHistory(s, t.stance) : null;
    const imp = importance01(s, t);
    const summary = challengeSummary(s, t);
    const circumstances: Record<string, number> = {};
    for (const it of t.items) {
      if (!it.tags.includes('circumstance') || !shown(it)) continue;
      const r = s.values.get(it.id);
      if (r?.kind === 'scale' && s.visible.get(it.id)) circumstances[it.key] = r4(r.v);
    }
    const result: TopicResult = {
      stance: stanceHist?.current === null || stanceHist === null ? null : r4(stanceHist.current),
      stanceLabel: stanceItem ? scaleLabel(stanceItem, s) : null,
      initialStance: stanceHist?.initial === null || stanceHist === null ? null : r4(stanceHist.initial),
      importance: imp === null ? null : r4(imp),
      complete: progress(s, t.id).complete,
      circumstances,
      challenges: {
        asked: summary.asked,
        held: summary.held,
        distinguished: summary.distinguished,
        moved: summary.moved,
        moves: summary.moves.map((m) => ({ source: m.source, delta: r4(m.delta), steps: m.steps })),
      },
    };
    topicResults[t.id] = result;

    for (const it of t.items) {
      const r = s.values.get(it.id);
      if (!r || !shown(it)) continue;
      if (t.domain === IDENTITY_DOMAIN) {
        // Described, never scored or counted as an interest; keyed by `topic.item`, so two topics'
        // items can't overwrite each other.
        const value = o.includeSensitive ? describeAnswer(it, s) : null;
        if (value !== null) identity[it.id] = value;
      } else if (r.kind === 'multi' && it.tags.includes('interest')) {
        for (const [opt, v] of r.picks) interests[`${it.id}.${opt}`] = r4(v);
      } else if (it.type === 'rating' && it.tags.includes('interest') && r.kind === 'scale') {
        interests[it.id] = r4((r.v + 1) / 2);
      }
    }
  }

  const tensions: Profile['tensions'] = detectTensions(s, obs, o.resolutions).map((t) => {
    const summary: Profile['tensions'][number] = {
      key: t.key,
      principle: t.principle,
      topics: [t.a.topic, t.b.topic],
      gap: r4(t.gap),
      status: t.status === 'resolved' && t.resolution ? t.resolution.kind : 'open',
    };
    if (t.status === 'resolved' && t.resolution?.reason) summary.reason = t.resolution.reason;
    return summary;
  });

  const profile: Profile = {
    format: 'whoami.profile',
    profileVersion: 1,
    contentVersion: b.contentVersion,
    appVersion: o.appVersion,
    generatedAt: o.now,
    scope: { sensitiveIncluded: o.includeSensitive, topics: topics.map((t) => t.id) },
    axes,
    principles,
    topics: topicResults,
    interests,
    tensions,
    evidence: Object.fromEntries(topics.map((t) => [t.id, t.evidence])),
    // Without sensitive answers, only orphans from topics known to be shareable count: a count can
    // still say something.
    completeness: { answered: answeredCount, orphaned: o.includeSensitive ? s.orphans.length : s.orphans.filter((e) => shareableOrphan(b, e.item)).length },
  };
  if (o.includeSensitive && Object.keys(identity).length) profile.identity = identity;
  return profile;
}

/** Label of the current answer on a scale item (e.g. "Legal in most cases"). */
export function scaleLabel(item: Item, s: AnswerState): string | null {
  const r = s.values.get(item.id);
  if (!r || r.kind !== 'scale') return null;
  if ((item.type === 'slider' || item.type === 'rating') && item.labels) return item.labels[r.step - 1] ?? null;
  if (item.type === 'likert' || item.type === 'importance') return item.labels[r.step - 1] ?? null;
  return null;
}

/** An orphaned answer whose topic still exists and isn't sensitive (its item was removed or renamed). */
function shareableOrphan(b: Bundle, item: string): boolean {
  const topic = b.topics.find((t) => t.id === item.split('.')[0]);
  return topic !== undefined && !topic.sensitive;
}

function describeAnswer(item: Item, s: AnswerState): string | string[] | null {
  const r = s.values.get(item.id);
  if (!r) return null;
  if (r.kind === 'option' && 'options' in item) return item.options.find((o) => o.id === r.option)?.label ?? null;
  if (r.kind === 'multi' && item.type === 'multi') {
    const picked = item.options.filter((o) => r.picks.has(o.id)).map((o) => o.label);
    return picked.length === 0 && typeof item.none === 'string' ? [item.none] : picked;
  }
  return scaleLabel(item, s);
}
