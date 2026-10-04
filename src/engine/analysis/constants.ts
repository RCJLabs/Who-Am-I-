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
export const LIMIT = { positions: 3, against: 1, for: 1, explore: 3, reflect: 3, drivers: 2 } as const;

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
