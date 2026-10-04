// What the on-device analysis finds, as ids, numbers and enums. Wording happens later, in
// src/app/analysis/compose.ts, so these stay testable without any copy.
import type { ReadingId, SuggestionId, SuggestionKind, TraditionId } from '../../model/analysis.ts';
import type { AxisFamily, AxisId, ItemId, PrincipleId, TopicId } from '../../model/content.ts';
import type { AnchorSide } from '../tensions.ts';

/** How much evidence a result rests on. */
export type Level = 'low' | 'medium' | 'high';

/** One topic's pull on a spectrum: its mean position (-1..1) and how much it weighed. */
export interface Driver {
  topic: TopicId;
  x: number;
  w: number;
}

export interface AxisFact {
  axis: AxisId;
  family: AxisFamily;
  score: number;
  confidence: number;
  level: Level;
  spread: number;
  topics: number;
  mixed: boolean;
  /** Topics pulling toward each pole, strongest first: [toward poles[0], toward poles[1]]. */
  drivers: [Driver[], Driver[]];
}

export interface PrincipleFact {
  principle: PrincipleId;
  score: number;
  confidence: number;
  level: Level;
  topics: number;
  consistency: number | null;
}

/** A topic where the user holds a firm, current view. */
export interface PositionFact {
  topic: TopicId;
  /** Current stance, -1..1. */
  value: number;
  /** 0..1, or null if the importance question wasn't answered. */
  importance: number | null;
}

/** How the user met a challenge, or null if it hasn't been asked yet. */
export type Met = 'held' | 'distinguished' | 'moved' | null;

/**
 * A cited case on one of the user's firmest positions: `against` is aimed at their side,
 * `for` is the case put to people on the other side.
 */
export interface CaseRec {
  kind: 'case';
  side: 'against' | 'for';
  topic: TopicId;
  challenge: ItemId;
  met: Met;
}

export type ExploreReason = 'finish' | 'map' | 'firm-up' | 'show' | 'consistency' | 'start';

export interface ExploreRec {
  kind: 'explore';
  topic: TopicId;
  reason: ExploreReason;
  /** The spectrum it would add or firm up, for 'map', 'firm-up' and 'show'. */
  axis?: AxisId;
  /** The principle it would test, for 'consistency'. */
  principle?: PrincipleId;
}

export type ReflectVariant = 'endorse-reject' | 'endorse-neutral' | 'neutral-reject';

export interface ReflectRec {
  kind: 'reflect';
  tension: string;
  principle: PrincipleId;
  /** The side where the principle is endorsed more, and the side where it's endorsed less. */
  hi: AnchorSide;
  lo: AnchorSide;
  variant: ReflectVariant;
}

export type TraditionStatus = 'insufficient' | 'mixed' | 'loose' | 'between' | 'match';

/** Distance in words, never a percentage. */
export type Closeness = 'very-close' | 'close' | 'some' | 'little';

/** Where the user differs most from a tradition: further toward a pole, or more or less weight on a principle. */
export type TraditionDifference =
  | { kind: 'axis'; axis: AxisId; toward: 0 | 1; gap: number }
  | { kind: 'principle'; principle: PrincipleId; more: boolean; gap: number };

export interface TraditionFit {
  tradition: TraditionId;
  distance: number;
  closeness: Closeness;
  differences: TraditionDifference[];
}

export interface TraditionFacts {
  status: TraditionStatus;
  /** Traditions the summary may name: the nearest for a match, the nearest two when between. */
  named: TraditionId[];
  /** Nearest first: three, or two when mixed; none without enough answers. */
  fits: TraditionFit[];
  /** The scored political spectrums compared. */
  compared: AxisId[];
  /** Political spectrums without a score yet. */
  missing: AxisId[];
  /** Compared principles that counted (only with enough principle evidence). */
  principles: PrincipleId[];
  /**
   * How closely the answers follow the nearest tradition question by question: the RMS gap over
   * the political questions both answered. Null without enough answers.
   */
  fit: { gap: number; questions: number } | null;
}

/** A reading from inside or outside a named tradition. */
export interface ReadingRec {
  kind: 'reading';
  reading: ReadingId;
  tradition: TraditionId;
  view: 'inside' | 'outside';
}

/** A link from research for a trait the answers clearly lean on, and which end of it they lean to. */
export interface SuggestionRec {
  kind: 'suggestion';
  suggestion: SuggestionId;
  /** Ways of working, free time or subjects to explore: at most one of each. */
  about: SuggestionKind;
  /** The end with more interest, or the other, where the same activity plays a small part. */
  end: 'toward' | 'away';
  /** The trait and the pole the answers lean to: 0 = its first pole, 1 = its second. */
  basis: { axis: AxisId; pole: 0 | 1 }[];
}

export interface AnalysisFacts {
  /** Results the user sees in each section (private: everything they answered). */
  axes: Record<AxisFamily, AxisFact[]>;
  principles: PrincipleFact[];
  /** What the summary and recommendations may use: never sensitive answers. */
  public: {
    axes: Record<AxisFamily, AxisFact[]>;
    principles: PrincipleFact[];
    positions: PositionFact[];
    tensions: { open: number; top: PrincipleId | null };
    /** Null until the analysis pack has loaded, or if there is none. */
    traditions: TraditionFacts | null;
  };
  next: {
    cases: CaseRec[];
    explore: ExploreRec[];
    reflect: ReflectRec[];
    readings: ReadingRec[];
    /** Links from research. Empty until the analysis pack has loaded, or if it has none. */
    suggestions: SuggestionRec[];
  };
}
