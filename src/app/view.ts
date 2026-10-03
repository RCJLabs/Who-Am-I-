// Pure helpers shared by screens. No DOM, no stores: easy to test.
import type { Response } from '../model/answers.ts';
import type { Axis, Bundle, Domain, Item, Option, Principle, Topic, TopicId } from '../model/content.ts';
import { isScale, scalePoints } from '../model/content.ts';
import type { Profile } from '../model/profile.ts';
import { progress, type FlowOptions } from '../engine/flow.ts';
import { hash32, mulberry32 } from '../engine/rng.ts';
import type { AnswerState } from '../engine/state.ts';

export interface TopicStatus {
  started: boolean;
  answered: number;
  remaining: number;
  complete: boolean;
}

export function topicStatus(s: AnswerState, topic: Topic, o: FlowOptions = {}): TopicStatus {
  const p = progress(s, topic.id, o);
  const started = topic.items.some((i) => s.latest.has(i.id));
  return { started, answered: p.answered, remaining: p.remaining, complete: started && p.complete };
}

/** The topic of the most recent answer, if it isn't finished. */
export function activeTopic(s: AnswerState, o: FlowOptions = {}): Topic | null {
  for (let i = s.events.length - 1; i >= 0; i--) {
    const topic = s.ix.topicOf.get(s.events[i]!.item);
    if (topic) return topicStatus(s, topic, o).complete ? null : topic;
  }
  return null;
}

/**
 * The first unfinished topic after `after` (wrapping around), core topics before deep dives, or
 * null if all are finished.
 */
export function nextTopic(b: Bundle, s: AnswerState, after?: TopicId, o: FlowOptions = {}): Topic | null {
  const start = after ? b.topics.findIndex((t) => t.id === after) + 1 : 0;
  const open = Array.from({ length: b.topics.length }, (_, k) => b.topics[(start + k) % b.topics.length]!).filter(
    (t) => t.id !== after && !topicStatus(s, t, o).complete,
  );
  return open.find((t) => t.tier === 'core') ?? open[0] ?? null;
}

/** Display text for an answer. */
export function answerLabel(item: Item, r: Response): string {
  switch (r.kind) {
    case 'skip':
      return 'Skipped';
    case 'unsure':
      return 'Not sure';
    case 'declined':
      return 'Prefer not to say';
    case 'scale': {
      if (!isScale(item)) return String(r.step);
      const labels = item.type === 'likert' || item.type === 'importance' ? item.labels : item.labels;
      if (labels?.[r.step - 1]) return labels[r.step - 1]!;
      if (item.type === 'slider' || item.type === 'rating') {
        const n = scalePoints(item);
        const pos = (r.step - 1) / (n - 1);
        if (pos === 0) return item.poles[0];
        if (pos === 1) return item.poles[1];
        if (pos === 0.5) return 'In between';
        return `Leaning “${pos < 0.5 ? item.poles[0] : item.poles[1]}”`;
      }
      return String(r.step);
    }
    case 'option': {
      if (!('options' in item)) return r.option;
      const label = (item.options as readonly { id: string; label: string }[]).find((o) => o.id === r.option)?.label ?? r.option;
      if (item.type === 'pair' && item.strength) return `${r.strength === 1 ? 'Slightly' : 'Strongly'}: ${label}`;
      return label;
    }
    case 'multi': {
      if (item.type !== 'multi') return '';
      const picked = item.options.filter((o) => o.id in r.picks);
      if (!picked.length) return 'None of these';
      return picked.map((o) => (typeof r.picks[o.id] === 'number' ? `${o.label} (${r.picks[o.id]}/5)` : o.label)).join(', ');
    }
  }
}

/** Deterministic per-user shuffle for options marked `shuffle`, so order effects average out. */
export function orderedOptions<T extends Option | { id: string; label: string }>(options: readonly T[], shuffle: boolean, seed: string, itemId: string): T[] {
  if (!shuffle) return [...options];
  const rand = mulberry32(hash32(`${seed}:${itemId}`));
  const out = [...options];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Which topics feed each axis (for "not enough data: answer these"). */
export function axisFeeders(b: Bundle): Map<string, Topic[]> {
  const out = new Map<string, Topic[]>();
  for (const t of b.topics) {
    const axes = new Set<string>();
    for (const it of t.items) {
      const effects = [
        ...('effects' in it ? it.effects : []),
        ...('options' in it ? it.options.flatMap((o) => ('effects' in o ? o.effects : [])) : []),
      ];
      for (const e of effects) if (e.target.startsWith('axis:')) axes.add(e.target.slice(5));
    }
    for (const a of axes) out.set(a, [...(out.get(a) ?? []), t]);
  }
  return out;
}

/** Every cited source in the content, deduplicated, for the About page. */
export function sources(b: Bundle): { topic: string; source: string }[] {
  const seen = new Set<string>();
  const out: { topic: string; source: string }[] = [];
  for (const t of b.topics) {
    for (const s of [t.source, ...t.items.map((i) => (i.type === 'challenge' ? i.source : undefined))]) {
      if (!s || seen.has(s) || /^original scenario$/i.test(s.trim())) continue;
      seen.add(s);
      out.push({ topic: t.title, source: s });
    }
  }
  return out;
}

/** Position on an axis (-1..1) as a percentage from the left. */
export function toPercent(score: number): number {
  return ((score + 1) / 2) * 100;
}

/** Big Five style 1–5 value from a -1..1 score. */
export function toFivePoint(score: number): number {
  return Math.round((score + 1) * 2 * 10) / 10 + 1;
}

// --- Results ---------------------------------------------------------------------------------

/** Plain-language position on a two-pole spectrum, e.g. "Leans Progress". */
export function positionLabel(score: number, poles: readonly [string, string]): string {
  const a = Math.abs(score);
  const pole = score < 0 ? poles[0] : poles[1];
  if (a < 0.15) return 'Center';
  if (a < 0.4) return `Leans ${pole}`;
  if (a < 0.7) return pole;
  return `Strongly ${pole}`;
}

/** Plain-language endorsement of a principle, e.g. "Strongly endorses". */
export function endorsementLabel(score: number): string {
  const a = Math.abs(score);
  if (a < 0.15) return 'Neutral';
  if (a < 0.4) return score > 0 ? 'Leans toward it' : 'Leans against it';
  if (a < 0.7) return score > 0 ? 'Endorses' : 'Rejects';
  return score > 0 ? 'Strongly endorses' : 'Strongly rejects';
}

export interface Leaning {
  axis: string;
  title: string;
  label: string;
}

/**
 * The clearest positions among these spectrums (at least the "Pole" band, not just "Leans"),
 * strongest and best-evidenced first.
 */
export function strongestLeanings(axes: readonly Axis[], scores: Profile['axes'], n = 3): Leaning[] {
  return axes
    .flatMap((a) => {
      const s = scores[a.id];
      if (!s || s.score === null || Math.abs(s.score) < 0.4) return [];
      return [{ axis: a.id, title: a.title, label: positionLabel(s.score, a.poles), strength: Math.abs(s.score) * s.confidence }];
    })
    .sort((x, y) => y.strength - x.strength)
    .slice(0, n)
    .map(({ axis, title, label }) => ({ axis, title, label }));
}

export interface RankedPrinciple {
  principle: Principle;
  score: number;
  result: Profile['principles'][string];
}

/** Scored principles, most endorsed first. */
export function rankedPrinciples(principles: readonly Principle[], scores: Profile['principles']): RankedPrinciple[] {
  return principles
    .flatMap((p) => {
      const r = scores[p.id];
      return r && r.score !== null ? [{ principle: p, score: r.score, result: r }] : [];
    })
    .sort((a, b) => b.score - a.score);
}

export interface ChallengeTotals {
  asked: number;
  held: number;
  distinguished: number;
  moved: number;
}

/** How the user handled challenges, summed over all topics. */
export function challengeTotals(topics: Profile['topics']): ChallengeTotals {
  const t: ChallengeTotals = { asked: 0, held: 0, distinguished: 0, moved: 0 };
  for (const r of Object.values(topics)) {
    t.asked += r.challenges.asked;
    t.held += r.challenges.held;
    t.distinguished += r.challenges.distinguished;
    t.moved += r.challenges.moved;
  }
  return t;
}

/** Topics with a stance answer, grouped by domain in content order. */
export function positionsByDomain(b: Bundle, topics: Profile['topics']): { domain: Domain; topics: Topic[] }[] {
  return b.domains
    .map((domain) => ({ domain, topics: b.topics.filter((t) => t.domain === domain.id && t.stance && topics[t.id]?.stance != null) }))
    .filter((g) => g.topics.length);
}
