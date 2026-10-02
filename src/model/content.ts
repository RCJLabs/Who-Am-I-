// The compiled content bundle: what the engine consumes. Produced only by src/compiler, so these
// are plain types (no runtime validation). Item ids are topic-qualified: "abortion.stance".
import type { AXIS_FAMILIES, EVIDENCE } from './authored.ts';

export type TopicId = string;
export type ItemId = string;
export type AxisId = string;
export type PrincipleId = string;
export type Target = `axis:${string}` | `principle:${string}`;
export type Evidence = (typeof EVIDENCE)[number];
export type AxisFamily = (typeof AXIS_FAMILIES)[number];

export interface Bundle {
  format: 'whoami.content';
  schema: 1;
  contentVersion: string;
  domains: Domain[];
  topics: Topic[];
  axes: Record<AxisId, Axis>;
  principles: Record<PrincipleId, Principle>;
  config: EngineConfig;
}

export interface EngineConfig {
  deepMinImportance: number;
  tension: { minGap: number; minAnchorWeight: number };
  principleDefaults: { minWeight: number; fullWeight: number; minTopics: number };
  display: { mixedSpread: number; mixedScore: number };
}

export interface Axis {
  id: AxisId;
  family: AxisFamily;
  title: string;
  description: string;
  poles: [string, string];
  minWeight: number;
  fullWeight: number;
  minTopics: number;
}

export interface Principle {
  id: PrincipleId;
  label: string;
  definition: string;
}

export interface Domain {
  id: string;
  title: string;
  blurb: string;
  sensitive: boolean;
}

export interface Topic {
  id: TopicId;
  domain: string;
  title: string;
  summary: string;
  tier: 'core' | 'extended';
  evidence: Evidence;
  source?: string;
  license?: string;
  instructions?: string;
  sensitive: boolean;
  stance?: ItemId;
  importance?: ItemId;
  items: Item[];
}

export type CmpOp = '<' | '<=' | '>' | '>=' | '==' | '!=';

export type Cond =
  | { op: 'and' | 'or'; args: Cond[] }
  | { op: 'not'; arg: Cond }
  | { op: 'cmp'; ref: ItemId; cmp: CmpOp; value: number }
  | { op: 'is'; ref: ItemId; option: string }
  | { op: 'has'; ref: ItemId; option: string }
  | { op: 'answered'; ref: ItemId };

/** Scale items: observation x = sign(w) * v with weight |w|. */
export interface Effect {
  target: Target;
  w: number;
}

/** Options: observation x = v (a position) with the item's weight. */
export interface OptionEffect {
  target: Target;
  v: number;
}

export interface Anchor {
  principle: PrincipleId;
  context: string;
  against?: string;
}

interface ItemBase {
  id: ItemId;
  key: string;
  topic: TopicId;
  text: string;
  help?: string;
  tags: string[];
  when?: Cond;
  deep: boolean;
  sticky: boolean;
  unsure: boolean;
  sensitive: boolean;
  anchor?: Anchor;
}

export interface LikertItem extends ItemBase {
  type: 'likert';
  points: 5 | 7;
  labels: string[];
  effects: Effect[];
}

export interface SliderItem extends ItemBase {
  type: 'slider';
  steps: 5 | 7 | 9 | 11;
  poles: [string, string];
  labels?: string[];
  effects: Effect[];
}

export interface RatingItem extends ItemBase {
  type: 'rating';
  points: 5;
  poles: [string, string];
  labels?: string[];
  effects: Effect[];
}

export interface ImportanceItem extends ItemBase {
  type: 'importance';
  points: 4;
  labels: string[];
}

export interface Option {
  id: string;
  label: string;
  value?: number;
  effects: OptionEffect[];
}

export interface ChoiceItem extends ItemBase {
  type: 'choice';
  options: Option[];
  shuffle: boolean;
  weight: number;
  /** Item-level effects, applied to the chosen option's value. */
  effects: Effect[];
}

export interface PairItem extends ItemBase {
  type: 'pair';
  options: [Option, Option];
  strength: boolean;
  weight: number;
}

export interface MultiItem extends ItemBase {
  type: 'multi';
  options: { id: string; label: string }[];
  intensity: boolean;
  max?: number;
}

export type Reaction = 'hold' | 'distinguish' | 'yield';

export interface ChallengeOption extends Option {
  reaction: Reaction;
  revise?: ItemId;
}

export interface ChallengeItem extends ItemBase {
  type: 'challenge';
  targets: ItemId;
  scenario: string;
  source?: string;
  options: ChallengeOption[];
  weight: number;
}

export interface ReaskItem extends ItemBase {
  type: 'reask';
  target: ItemId;
}

export type ScaleItem = LikertItem | SliderItem | RatingItem | ImportanceItem;
export type OptionItem = ChoiceItem | PairItem | ChallengeItem;
export type Item = ScaleItem | OptionItem | MultiItem | ReaskItem;

export function isScale(item: Item): item is ScaleItem {
  return item.type === 'likert' || item.type === 'slider' || item.type === 'rating' || item.type === 'importance';
}

export function isOptionItem(item: Item): item is OptionItem {
  return item.type === 'choice' || item.type === 'pair' || item.type === 'challenge';
}

/** Number of points/steps on a scale item. */
export function scalePoints(item: ScaleItem): number {
  return item.type === 'slider' ? item.steps : item.points;
}
