// Pure helpers shared by screens. No DOM, no stores: easy to test.
import type { AnalysisPack } from '../model/analysis.ts';
import type { Response } from '../model/answers.ts';
import type { Axis, AxisId, Bundle, Domain, Item, Option, Principle, Topic, TopicId } from '../model/content.ts';
import { isScale, scalePoints } from '../model/content.ts';
import type { Profile } from '../model/profile.ts';
import { BAND } from '../engine/analysis/constants.ts';
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
  for (const t of b.topics) for (const a of t.feeds) out.set(a, [...(out.get(a) ?? []), t]);
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
  if (a < BAND.center) return 'Center';
  if (a < BAND.leans) return `Leans ${pole}`;
  if (a < BAND.strong) return pole;
  return `Strongly ${pole}`;
}

/** Plain-language endorsement of a principle, e.g. "Strongly endorses". */
export function endorsementLabel(score: number): string {
  const a = Math.abs(score);
  if (a < BAND.center) return 'Neutral';
  if (a < BAND.leans) return score > 0 ? 'Leans toward it' : 'Leans against it';
  if (a < BAND.strong) return score > 0 ? 'Endorses' : 'Rejects';
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
      if (!s || s.score === null || Math.abs(s.score) < BAND.leans) return [];
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

export interface InterestEntry {
  key: string;
  kind: 'pick' | 'rating';
  /** The option picked, or the rating question. */
  label: string;
  /** For ratings, the answer in words. */
  answer?: string;
  /** 0..1 */
  v: number;
}

/**
 * Interests, strongest first: multi-select picks by their option label (`topic.item.option`) and
 * ratings by their question (`topic.item`).
 */
export function interestList(interests: Profile['interests'], s: AnswerState): InterestEntry[] {
  const out: InterestEntry[] = [];
  for (const [key, v] of Object.entries(interests)) {
    const parts = key.split('.');
    if (parts.length === 3) {
      const item = s.ix.items.get(`${parts[0]}.${parts[1]}`);
      const label = item?.type === 'multi' ? item.options.find((o) => o.id === parts[2])?.label : undefined;
      if (label) out.push({ key, kind: 'pick', label, v });
    } else if (parts.length === 2) {
      const item = s.ix.items.get(key);
      const ev = s.latest.get(key);
      if (item && ev) out.push({ key, kind: 'rating', label: item.text, answer: answerLabel(item, ev.r), v });
    }
  }
  return out.sort((a, b) => b.v - a.v);
}

/** Topics with a stance answer, grouped by domain in content order. */
export function positionsByDomain(b: Bundle, topics: Profile['topics']): { domain: Domain; topics: Topic[] }[] {
  return b.domains
    .map((domain) => ({ domain, topics: b.topics.filter((t) => t.domain === domain.id && t.stance && topics[t.id]?.stance != null) }))
    .filter((g) => g.topics.length);
}

/** A political tradition on the map. */
export interface MapRef {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Its adherents split on either map spectrum: drawn hollow. */
  divided: boolean;
  /** Listed by the analysis, so labelled on the map. */
  labelled: boolean;
}

/** Every tradition placed on both map spectrums; the listed ones are labelled. */
export function traditionRefs(pack: AnalysisPack, mapAxes: readonly [AxisId, AxisId], listed: readonly string[]): MapRef[] {
  const [ax, ay] = mapAxes;
  return pack.traditions.flatMap((t) => {
    const x = t.positions[ax];
    const y = t.positions[ay];
    if (x === undefined || y === undefined) return [];
    return [{ id: t.id, name: t.name, x, y, divided: t.divided.includes(ax) || t.divided.includes(ay), labelled: listed.includes(t.id) }];
  });
}

export interface PositionTable {
  /** The political spectrums the traditions are placed on, in content order. */
  columns: { id: AxisId; title: string }[];
  /** The user first, then every tradition by name. */
  rows: { id: string; name: string; cells: string[] }[];
}

/** Everyone's position on each political spectrum, in words: the map's text equivalent. */
export function traditionTable(
  b: Bundle,
  pack: AnalysisPack,
  profile: Pick<Profile, 'axes'>,
  words: { you: string; divided: string; none: string },
): PositionTable {
  const axes = Object.values(b.axes).filter((a) => a.family === 'political' && pack.traditions.every((t) => a.id in t.positions));
  const you = axes.map((a) => {
    const score = profile.axes[a.id]?.score;
    return score === null || score === undefined ? words.none : positionLabel(score, a.poles);
  });
  const rows = [...pack.traditions]
    .sort((x, y) => x.name.localeCompare(y.name))
    .map((t) => ({ id: t.id, name: t.name, cells: axes.map((a) => (t.divided.includes(a.id) ? words.divided : positionLabel(t.positions[a.id]!, a.poles))) }));
  return { columns: axes.map((a) => ({ id: a.id, title: a.title })), rows: [{ id: 'you', name: words.you, cells: you }, ...rows] };
}
