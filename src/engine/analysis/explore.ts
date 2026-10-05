// Topics to explore next: finish the one in progress, then the unstarted topics that would add
// the most to the results: spectrums that can't show yet, results resting on few answers, and
// strongly held principles tested in only one setting so far. Never sensitive topics, never
// worldview or identity.
import { IDENTITY_DOMAIN, type AxisId, type Bundle, type PrincipleId, type Topic } from '../../model/content.ts';
import type { Profile } from '../../model/profile.ts';
import { progress, type FlowOptions } from '../flow.ts';
import type { AnswerState } from '../state.ts';
import { CONSISTENCY_BONUS, CORE_BONUS, ENDORSE, FAMILY_WEIGHT, LIMIT, STANCE_WEIGHT, UNSCORED_BONUS } from './constants.ts';
import type { ExploreRec } from './types.ts';

export interface ExploreOptions extends FlowOptions {
  /** Spectrums drawn on the map; showing one counts double. */
  mapAxes?: readonly AxisId[];
}

const NEVER_SUGGESTED = new Set(['worldview', IDENTITY_DOMAIN]);

export function suggestable(b: Bundle, t: Topic): boolean {
  return !t.sensitive && !NEVER_SUGGESTED.has(t.domain) && !b.domains.find((d) => d.id === t.domain)?.sensitive;
}

export function exploreNext(s: AnswerState, profile: Profile, o: ExploreOptions = {}, n: number = LIMIT.explore): ExploreRec[] {
  const b = s.ix.bundle;
  const out: ExploreRec[] = [];
  const started = (t: Topic) => t.items.some((i) => s.latest.has(i.id));

  // The topic in progress comes first.
  for (let i = s.events.length - 1; i >= 0; i--) {
    const t = s.ix.topicOf.get(s.events[i]!.item);
    if (!t) continue;
    if (suggestable(b, t) && !progress(s, t.id, o).complete) out.push({ kind: 'explore', topic: t.id, reason: 'finish' });
    break;
  }

  const confidence = new Map<AxisId, number>();
  const scored = new Set<AxisId>();
  for (const [id, r] of Object.entries(profile.axes)) {
    confidence.set(id, r.score === null ? 0 : r.confidence);
    if (r.score !== null) scored.add(id);
  }
  // Strongly held principles, and how many answered topics test each with an anchor.
  const strong = new Set<PrincipleId>(Object.entries(profile.principles).flatMap(([id, r]) => (r.score !== null && Math.abs(r.score) >= ENDORSE ? [id] : [])));
  const tested = new Map<PrincipleId, number>();
  for (const t of b.topics) {
    for (const p of t.anchors) if (t.items.some((i) => i.anchor?.principle === p && s.values.has(i.id))) tested.set(p, (tested.get(p) ?? 0) + 1);
  }
  const map = new Set(o.mapAxes ?? []);

  const pool = b.topics.filter((t) => suggestable(b, t) && !started(t) && !out.some((r) => r.topic === t.id));
  while (out.length < n) {
    let best: { t: Topic; gain: number; rec: ExploreRec } | null = null;
    for (const t of pool) {
      const g = gain(t);
      if (g.gain > 0 && (!best || g.gain > best.gain)) best = { t, ...g };
    }
    if (!best) break;
    out.push(best.rec);
    pool.splice(pool.indexOf(best.t), 1);
    // Assume the topic gets answered, so the next pick spreads to other results.
    for (const a of best.t.feeds) {
      confidence.set(a, Math.min(1, (confidence.get(a) ?? 0) + delta(best.t, a)));
      scored.add(a);
    }
    for (const p of best.t.anchors) tested.set(p, (tested.get(p) ?? 0) + 1);
  }
  return out;

  function delta(t: Topic, a: AxisId): number {
    const axis = b.axes[a];
    return axis ? STANCE_WEIGHT[t.tier] / axis.fullWeight : 0;
  }

  function gain(t: Topic): { gain: number; rec: ExploreRec } {
    let total = t.tier === 'core' ? CORE_BONUS : 0;
    let firm: { axis: AxisId; g: number } | null = null;
    let show: { axis: AxisId; g: number; map: boolean } | null = null;
    for (const a of t.feeds) {
      const axis = b.axes[a];
      if (!axis) continue;
      const w = FAMILY_WEIGHT[axis.family];
      const g = w * Math.min(1 - (confidence.get(a) ?? 0), delta(t, a));
      total += g;
      if (g > 0 && (!firm || g > firm.g)) firm = { axis: a, g };
      if (!scored.has(a) && w > 0) {
        const bonus = UNSCORED_BONUS * w * (map.has(a) ? 2 : 1);
        total += bonus;
        if (!show || bonus > show.g) show = { axis: a, g: bonus, map: map.has(a) };
      }
    }
    const principle = t.anchors.find((p) => strong.has(p) && tested.get(p) === 1);
    const consistency = t.anchors.filter((p) => strong.has(p) && tested.get(p) === 1).length * CONSISTENCY_BONUS;
    total += consistency;

    let rec: ExploreRec;
    if (show) rec = { kind: 'explore', topic: t.id, reason: show.map ? 'map' : 'show', axis: show.axis };
    else if (principle && consistency >= (firm?.g ?? 0)) rec = { kind: 'explore', topic: t.id, reason: 'consistency', principle };
    else if (firm) rec = { kind: 'explore', topic: t.id, reason: 'firm-up', axis: firm.axis };
    else rec = { kind: 'explore', topic: t.id, reason: 'start' };
    return { gain: total, rec };
  }
}
