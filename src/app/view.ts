// Pure helpers shared by screens. No DOM, no stores: easy to test.
import type { AnalysisPack } from '../model/analysis.ts';
import type { Response } from '../model/answers.ts';
import type { Axis, AxisFamily, AxisId, Bundle, Domain, Item, Option, Principle, Topic, TopicId } from '../model/content.ts';
import { isScale, scalePoints } from '../model/content.ts';
import type { Profile } from '../model/profile.ts';
import { BAND, LOW_CONFIDENCE } from '../engine/analysis/constants.ts';
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

// --- Results overview ------------------------------------------------------------------------
// What the overview draws: all from the public profile (answers that could be shared), never
// worldview or taste, and never a trait the summary leaves unnamed (see docs/ANALYSIS.md).

/** The areas in the overview's pattern, in the ring order their colours were validated in. */
export const PATTERN_AREAS = [
  { area: 'politics', family: 'political' },
  { area: 'personality', family: 'personality' },
  { area: 'thinking', family: 'thinking' },
  { area: 'values', family: 'values' },
] as const satisfies readonly { area: string; family: AxisFamily }[];
export type PatternArea = (typeof PATTERN_AREAS)[number]['area'];

/** Fewer spectrums than this make no pattern worth drawing. */
export const PATTERN_MIN = 3;

export interface PatternSpoke {
  axis: AxisId;
  title: string;
  label: string;
  /** How firmly the answers lean, either way: 0..1. */
  strength: number;
  /** Based on few answers so far, as the spectrum's hollow dot shows. */
  low: boolean;
}

export interface PatternGroup {
  area: PatternArea;
  spokes: PatternSpoke[];
}

/** One spoke per scored spectrum, grouped by area in ring order; areas with none are left out. */
export function patternGroups(axes: readonly Axis[], scores: Profile['axes'], unnamed: ReadonlySet<string>): PatternGroup[] {
  return PATTERN_AREAS.map(({ area, family }) => ({
    area,
    spokes: axes.flatMap((a) => {
      const s = scores[a.id];
      if (a.family !== family || unnamed.has(a.id) || !s || s.score === null) return [];
      return [{ axis: a.id, title: a.title, label: positionLabel(s.score, a.poles), strength: Math.min(1, Math.abs(s.score)), low: s.confidence < LOW_CONFIDENCE }];
    }),
  })).filter((g) => g.spokes.length > 0);
}

export interface FirmLean extends Leaning {
  area: PatternArea;
}

/** The firmest leans across the pattern's spectrums, by the same rule as the summary's headline. */
export function firmestLeans(axes: readonly Axis[], scores: Profile['axes'], unnamed: ReadonlySet<string>, n = 3): FirmLean[] {
  const areaOf = new Map<AxisFamily, PatternArea>(PATTERN_AREAS.map((p) => [p.family, p.area]));
  const pool = axes.filter((a) => areaOf.has(a.family) && !unnamed.has(a.id));
  const family = new Map(pool.map((a) => [a.id, a.family]));
  return strongestLeanings(pool, scores, n).map((l) => ({ ...l, area: areaOf.get(family.get(l.axis)!)! }));
}

/**
 * An area card's line: the family's two clearest positions off the center ("Strongly Progress ·
 * Global"), the best-evidenced first, or null.
 */
export function areaLean(axes: readonly Axis[], scores: Profile['axes'], family: AxisFamily, unnamed: ReadonlySet<string>): string | null {
  const parts = axes
    .flatMap((a) => {
      const s = scores[a.id];
      if (a.family !== family || unnamed.has(a.id) || !s || s.score === null || Math.abs(s.score) < BAND.center) return [];
      return [{ label: positionLabel(s.score, a.poles), strength: Math.abs(s.score) * s.confidence }];
    })
    .sort((x, y) => y.strength - x.strength)
    .slice(0, 2)
    .map((p) => p.label);
  return parts.length ? parts.join(' · ') : null;
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

// --- Political map and traditions -------------------------------------------------------------

/** The map's two views, as [across, up]: each shows once both its spectrums are scored. */
export const MAP_VIEWS = [
  ['economic', 'civil'],
  ['cultural', 'diplomatic'],
] as const satisfies readonly (readonly [AxisId, AxisId])[];

/** A political spectrum as one of the map's axes, with where the answers sit on it. */
export interface MapAxis {
  id: AxisId;
  title: string;
  poles: [string, string];
  score: number;
  confidence: number;
}

export interface MapView {
  id: string;
  x: MapAxis;
  y: MapAxis;
}

/** The map views whose two spectrums are both scored, in order. */
export function mapViews(b: Bundle, scores: Profile['axes'], pairs: readonly (readonly [AxisId, AxisId])[] = MAP_VIEWS): MapView[] {
  const axis = (id: AxisId): MapAxis | null => {
    const a = b.axes[id];
    const s = scores[id];
    return a && s && s.score !== null ? { id, title: a.title, poles: a.poles, score: s.score, confidence: s.confidence } : null;
  };
  return pairs.flatMap(([xi, yi]) => {
    const x = axis(xi);
    const y = axis(yi);
    return x && y ? [{ id: `${xi}-${yi}`, x, y }] : [];
  });
}

/** A political tradition, for the map: where it sits, and its place among the nearest. */
export interface MapTradition {
  id: string;
  name: string;
  positions: Readonly<Record<AxisId, number>>;
  /** What its adherents split on: no single position there. */
  divided: readonly string[];
  /** Its place in the list of nearest traditions (0 = nearest), or null when not listed. */
  rank: number | null;
  /** How close it is, in words, when listed. */
  band: string | null;
}

/** Every tradition in the pack, the listed (nearest) ones ranked in list order. */
export function mapTraditions(pack: AnalysisPack, listed: readonly { id: string; band: string }[]): MapTradition[] {
  return pack.traditions.map((t) => {
    const rank = listed.findIndex((r) => r.id === t.id);
    return { id: t.id, name: t.name, positions: t.positions, divided: t.divided, rank: rank < 0 ? null : rank, band: rank < 0 ? null : listed[rank]!.band };
  });
}

/** One spectrum of a comparison between the answers and a tradition. */
export interface Comparison {
  axis: AxisId;
  title: string;
  poles: [string, string];
  /** Where the answers sit, or null without enough of them. */
  you: number | null;
  /** Where the tradition sits, or null where its adherents split. */
  them: number | null;
}

/** The answers beside a tradition on each political spectrum it is placed on, in content order. */
export function compareWith(b: Bundle, scores: Profile['axes'], t: { positions: Readonly<Record<AxisId, number>>; divided: readonly string[] }): Comparison[] {
  return Object.values(b.axes)
    .filter((a) => a.family === 'political' && t.positions[a.id] !== undefined)
    .map((a) => ({ axis: a.id, title: a.title, poles: a.poles, you: scores[a.id]?.score ?? null, them: t.divided.includes(a.id) ? null : t.positions[a.id]! }));
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
