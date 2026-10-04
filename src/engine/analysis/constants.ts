// Thresholds for the on-device analysis. Documented in docs/ANALYSIS.md; change both together.
import type { AxisFamily } from '../../model/content.ts';

/** Score bands, shared with the result labels ("Center", "Leans X", "X", "Strongly X"). */
export const BAND = { center: 0.15, leans: 0.4, strong: 0.7 } as const;

/** Below this confidence a result is drawn hollow and described as based on few answers. */
export const LOW_CONFIDENCE = 0.5;
/** Confidence at or above which evidence counts as "high". */
export const HIGH_CONFIDENCE = 0.8;

/** A position counts as firm from this distance from the middle of its scale (-1..1). */
export const FIRM_POSITION = 0.5;

/** How many of each kind of recommendation to show. */
export const LIMIT = {
  positions: 3,
  against: 1,
  for: 1,
  explore: 3,
  reflect: 3,
  drivers: 2,
  /** Political traditions listed, and differences named for each. */
  traditions: 3,
  differences: 2,
  /** Readings for a matched tradition (for two traditions, one of each from both). */
  readings: { inside: 2, outside: 2 },
  /** Personal suggestions, at most one of each kind. */
  suggestions: 3,
} as const;

/** Personal suggestions: a spectrum counts only with this much evidence (3 of a trait's 4 short-form items). */
export const SUGGEST = { confidence: 0.75 } as const;

/** Political traditions: reference points, never labels. See docs/ANALYSIS.md. */
export const TRADITION = {
  /** Below this many scored political spectrums, or this much total confidence, no comparison. */
  minAxes: 2,
  minConfidence: 1,
  /** A spectrum or principle a tradition's adherents split on counts this much. */
  dividedWeight: 0.5,
  /** Share of the squared distance that compared principles take, once there's enough evidence. */
  principleShare: 0.25,
  /** Summed confidence of the scored compared principles before they count. */
  principleEvidence: 3,
  /** Political questions the answers and the nearest tradition's sheet must share before comparing. */
  minQuestions: 4,
  /**
   * A tradition is named only when the answers follow it question by question: an RMS gap to its
   * sheet's answers of at most this (-1..1 scales; one step on a 7-point scale is 0.33). Above it,
   * the answers pull different ways and only average out near the tradition.
   */
  fit: 0.55,
  /** Nearest distance at or above this: no tradition is a close fit. */
  loose: 0.35,
  /** Second nearest within this of the nearest: between the two. */
  between: 0.04,
  /** Closeness bands by distance: very close, close, then some overlap below `loose`. */
  band: { veryClose: 0.15, close: 0.25 },
  /** Gaps at least this large are named as differences. */
  difference: 0.35,
} as const;

/**
 * Explore-next weighting by spectrum family: how much firming up a result in each family is
 * worth. Worldview is zero: the app never nudges anyone toward questions about religion.
 */
export const FAMILY_WEIGHT: Record<AxisFamily, number> = {
  political: 1,
  personality: 1,
  values: 0.8,
  thinking: 0.6,
  taste: 0.2,
  worldview: 0,
};
/** Explore-next bonus for a topic that would let an unscored spectrum show at all. */
export const UNSCORED_BONUS = 0.3;
/** Explore-next bonus for testing a strongly held principle that only one answered topic anchors. */
export const CONSISTENCY_BONUS = 0.2;
/** Explore-next tie-breaker for core topics. */
export const CORE_BONUS = 0.05;
/** Evidence a topic adds to each spectrum it feeds, as a share of its stance weight. */
export const STANCE_WEIGHT = { core: 1, extended: 0.5 } as const;

/** A tension side counts as endorsing or rejecting its principle past this (-1..1). */
export const ENDORSE = 0.4;
