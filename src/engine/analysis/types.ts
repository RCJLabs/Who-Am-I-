// What the on-device analysis finds, as ids, numbers and enums. Wording happens later, in
// src/app/analysis/compose.ts, so these stay testable without any copy.
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
  };
  next: {
    cases: CaseRec[];
    explore: ExploreRec[];
    reflect: ReflectRec[];
  };
}
