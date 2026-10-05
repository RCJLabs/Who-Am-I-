// Share cards: what each card says. Built only from the public profile (answers that could be
// shared, every score recomputed without the rest), like the overview: never worldview or taste,
// never a sensitive topic, and never a trait the summary leaves unnamed. Pure: render.ts draws them.
import { BAND, LOW_CONFIDENCE, UNNAMED_TRAITS } from '../../engine/analysis/constants.ts';
import type { TraditionFacts } from '../../engine/analysis/types.ts';
import type { Axis, AxisId, Principle } from '../../model/content.ts';
import type { Profile } from '../../model/profile.ts';
import { copy, list } from '../copy.ts';
import type { CardId } from '../routes.ts';
import {
  areaLean,
  endorsementLabel,
  firmestLeans,
  patternGroups,
  PATTERN_AREAS,
  PATTERN_MIN,
  positionLabel,
  rankedPrinciples,
  type FirmLean,
  type PatternArea,
  type PatternGroup,
} from '../view.ts';

/** Principles drawn: all of them up to `all`; past that, the most endorsed and up to `rejected` of the most rejected. */
export const PRINCIPLES_SHOWN = { all: 6, rejected: 2 } as const;

/** One spectrum on an area's card. */
export interface CardStrip {
  axis: AxisId;
  title: string;
  poles: readonly [string, string];
  score: number;
  /** How sure the app is, 0..1: the shaded band around the dot, as on the results pages. */
  confidence: number;
  /** Where the answers sit, in words: "Strongly Progress". */
  label: string;
  /** Based on few answers: drawn hollow. */
  low: boolean;
}

/** One principle on the principles card. */
export interface CardBar {
  id: string;
  label: string;
  score: number;
  /** "Strongly endorses", "Rejects"… */
  words: string;
  low: boolean;
}

/** The political tradition the answers sit closest to, when the analysis names one (or two). */
export interface CardTradition {
  label: string;
  name: string;
  /** How close, in words, for a single tradition. */
  band: string | null;
}

interface Base {
  id: CardId;
  /** The card's title, as drawn on it. */
  name: string;
  /** "My results so far · 18 topics". */
  footer: string;
  /** Some marks rest on few answers: drawn hollow (bars lighter), and this note says so. */
  note: string | null;
  /** Everything the card says, as text: the image's alternative text. */
  alt: string;
}

export interface PatternCard extends Base {
  kind: 'pattern';
  groups: PatternGroup[];
  total: number;
  firm: FirmLean[];
}

export interface SpectrumCard extends Base {
  kind: 'spectrums';
  area: PatternArea;
  /** The area's two clearest positions: "Strongly Progress · Global". */
  line: string;
  strips: CardStrip[];
  tradition: CardTradition | null;
}

export interface PrinciplesCard extends Base {
  kind: 'principles';
  line: string;
  bars: CardBar[];
  /** Where principles are left out, between the most endorsed and the most rejected: the first bar after the gap. */
  skipAt: number | null;
}

export type ShareCard = PatternCard | SpectrumCard | PrinciplesCard;

export interface CardInput {
  axes: readonly Axis[];
  principles: readonly Principle[];
  /** The public profile: answers that could be shared, every score recomputed without the rest. */
  profile: Pick<Profile, 'axes' | 'principles' | 'scope'>;
  /** The comparison with political traditions (itself made from shareable answers), once loaded. */
  traditions?: { facts: TraditionFacts; name: (id: string) => string } | null;
}

const C = copy.share.card;
const FAMILY = Object.fromEntries(PATTERN_AREAS.map((p) => [p.area, p.family])) as Record<PatternArea, Axis['family']>;
/** Card text joined into the alternative text, which adds its own full stops. */
const bare = (text: string) => text.replace(/\.$/, '');

/** Every card there's enough to draw, in CARD_IDS order (routes.ts): the pattern, then the areas as the overview lists them. */
export function shareCards(i: CardInput): ShareCard[] {
  const footer = C.footer(i.profile.scope.topics.length);
  const cards: (ShareCard | null)[] = [
    patternCard(i, footer),
    spectrumCard(i, 'politics', footer),
    spectrumCard(i, 'values', footer),
    spectrumCard(i, 'thinking', footer),
    spectrumCard(i, 'personality', footer),
    principlesCard(i, footer),
  ];
  return cards.filter((c) => c !== null);
}

function patternCard(i: CardInput, footer: string): PatternCard | null {
  const groups = patternGroups(i.axes, i.profile.axes, UNNAMED_TRAITS);
  const total = groups.reduce((n, g) => n + g.spokes.length, 0);
  if (total < PATTERN_MIN) return null;
  const firm = firmestLeans(i.axes, i.profile.axes, UNNAMED_TRAITS);
  const note = groups.some((g) => g.spokes.some((s) => s.low)) ? C.low : null;
  const name = C.names.pattern;
  const parts = [
    C.across(total, groups.map((g) => C.areas[g.area])),
    firm.length ? `${C.firmest}: ${list(firm.map((f) => `${f.label} (${f.title})`))}` : C.middle,
    ...(note ? [bare(note)] : []),
    footer,
  ];
  return { kind: 'pattern', id: 'pattern', name, groups, total, firm, footer, note, alt: C.alt(name, parts) };
}

function spectrumCard(i: CardInput, area: PatternArea, footer: string): SpectrumCard | null {
  const family = FAMILY[area];
  const strips: CardStrip[] = i.axes.flatMap((a) => {
    const s = i.profile.axes[a.id];
    if (a.family !== family || UNNAMED_TRAITS.has(a.id) || !s || s.score === null) return [];
    return [{ axis: a.id, title: a.title, poles: a.poles, score: s.score, confidence: s.confidence, label: positionLabel(s.score, a.poles), low: s.confidence < LOW_CONFIDENCE }];
  });
  if (!strips.length) return null;
  const line = areaLean(i.axes, i.profile.axes, family, UNNAMED_TRAITS) ?? C.middle;
  const tradition = area === 'politics' ? closestTradition(i.traditions) : null;
  const note = strips.some((s) => s.low) ? C.low : null;
  const name = C.names[area];
  const parts = [
    line,
    ...strips.map((s) => `${s.title}: ${s.label}`),
    ...(tradition ? [`${tradition.label}: ${tradition.name}${tradition.band ? `, ${tradition.band.toLowerCase()}` : ''}`] : []),
    ...(note ? [bare(note)] : []),
    footer,
  ];
  return { kind: 'spectrums', id: area, area, name, line, strips, tradition, footer, note, alt: C.alt(name, parts) };
}

function principlesCard(i: CardInput, footer: string): PrinciplesCard | null {
  const ranked = rankedPrinciples(i.principles, i.profile.principles);
  if (ranked.length < PATTERN_MIN) return null;
  const { all, rejected } = PRINCIPLES_SHOWN;
  const bottom = ranked.length > all ? ranked.slice(-rejected).filter((r) => r.score <= -BAND.center) : [];
  const shown = ranked.length > all ? [...ranked.slice(0, all - bottom.length), ...bottom] : ranked;
  const bars = shown.map((r) => ({ id: r.principle.id, label: r.principle.label, score: r.score, words: endorsementLabel(r.score), low: r.result.confidence < LOW_CONFIDENCE }));
  const top = ranked.filter((r) => r.score >= BAND.leans).slice(0, 2).map((r) => r.principle.label);
  const line = top.length ? copy.analysis.overview.line.principles(top) : copy.analysis.overview.line.principleCount(ranked.length);
  const note = bars.some((b) => b.low) ? C.lighter : null;
  const name = C.names.principles;
  const parts = [line, ...bars.map((b) => `${b.label}: ${b.words}`), ...(note ? [bare(note)] : []), footer];
  const skipAt = bottom.length ? shown.length - bottom.length : null;
  return { kind: 'principles', id: 'principles', name, line, bars, skipAt, footer, note, alt: C.alt(name, parts) };
}

/** The tradition the summary names, or the two it sits between; nothing for a loose or mixed fit. */
function closestTradition(t: CardInput['traditions']): CardTradition | null {
  if (!t) return null;
  const { facts, name } = t;
  const [first, second] = facts.named;
  if (facts.status === 'match' && first) {
    const fit = facts.fits.find((f) => f.tradition === first);
    return { label: C.closest, name: name(first), band: fit ? copy.analysis.traditions.closeness[fit.closeness] : null };
  }
  if (facts.status === 'between' && first && second) return { label: C.between, name: list([name(first), name(second)]), band: null };
  return null;
}
