// Schemas for the YAML files authors write under content/. Strict objects: an unknown key is a
// typo until proven otherwise. These schemas also generate schema/topic.schema.json for editors.
import { z } from 'zod';

export const ID_RE = /^[a-z][a-z0-9_]*$/;
export const REF_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?$/;

const Id = z.string().regex(ID_RE, 'ids are snake_case: a-z, 0-9, _ (starting with a letter)');
const Ref = z
  .string()
  .regex(REF_RE, 'a reference is a local item id, or topic.item for another topic')
  .describe('Item id in this topic, or topic.item');

const EffectMap = z
  .record(Id, z.number())
  .describe(
    'On scale items: weights (sign = which way agreeing pushes). On options: positions in [-1, 1]. ' +
      'A target that is not listed means "no information".',
  );

const Anchor = z
  .strictObject({
    principle: Id.describe('The single principle this item probes'),
    context: z.string().min(1).describe('Short phrase naming the context, e.g. "continuing a pregnancy"'),
    against: z
      .string()
      .min(1)
      .optional()
      .describe('The competing interest in this context, used to suggest a relevant difference on tension cards'),
  })
  .describe('Marks a matched-wording probe of one principle; the only items the tension detector compares');

const base = {
  id: Id,
  text: z.string().min(1).describe('The question or statement shown to the user'),
  help: z.string().min(1).optional(),
  tags: z.array(Id).optional().describe('Free tags, e.g. circumstance'),
  when: z
    .string()
    .min(1)
    .optional()
    .describe('Show only when this condition is true, e.g. "stance < 0 and rape > 0". Refs must be earlier items.'),
  deep: z.boolean().optional().describe('Skipped when the user says the topic matters little to them'),
  sticky: z
    .boolean()
    .optional()
    .describe('Keep scoring the answer even if the item later becomes hidden (default: true for challenges)'),
  unsure: z.boolean().optional().describe('Offer "No opinion / not sure" (default true)'),
  sensitive: z.boolean().optional().describe('Adds "Prefer not to say"; inherited from the topic'),
};

const scaleEffects = {
  axes: EffectMap.optional(),
  principles: EffectMap.optional(),
  anchor: Anchor.optional(),
};

export const LikertSchema = z.strictObject({
  ...base,
  ...scaleEffects,
  type: z.literal('likert'),
  points: z.union([z.literal(5), z.literal(7)]),
  labels: z
    .union([z.literal('agree'), z.literal('accuracy'), z.array(z.string().min(1))])
    .optional()
    .describe('agree (default), accuracy (IPIP), or explicit labels'),
});

export const SliderSchema = z.strictObject({
  ...base,
  ...scaleEffects,
  type: z.literal('slider'),
  steps: z.union([z.literal(5), z.literal(7), z.literal(9), z.literal(11)]),
  poles: z.tuple([z.string().min(1), z.string().min(1)]).describe('[left end, right end]'),
  labels: z.array(z.string().min(1)).optional().describe('One label per step'),
});

export const RatingSchema = z.strictObject({
  ...base,
  axes: EffectMap.optional(),
  principles: EffectMap.optional(),
  type: z.literal('rating'),
  points: z.literal(5).optional(),
  poles: z.tuple([z.string().min(1), z.string().min(1)]),
  labels: z.array(z.string().min(1)).optional(),
});

export const ImportanceSchema = z.strictObject({
  ...base,
  type: z.literal('importance'),
});

const OptionSchema = z.strictObject({
  id: Id,
  label: z.string().min(1),
  value: z.number().min(-1).max(1).optional().describe('Position used by conditions and item-level effects'),
  axes: EffectMap.optional(),
  principles: EffectMap.optional(),
});

export const ChoiceSchema = z.strictObject({
  ...base,
  axes: EffectMap.optional(),
  principles: EffectMap.optional(),
  type: z.literal('choice'),
  options: z.array(OptionSchema).min(2),
  shuffle: z.boolean().optional().describe('Randomize option order per user (for unordered options)'),
  weight: z.number().positive().optional().describe('Weight of option positions (default 1)'),
});

export const PairSchema = z.strictObject({
  ...base,
  type: z.literal('pair'),
  options: z.tuple([OptionSchema, OptionSchema]),
  strength: z.boolean().optional().describe('Ask "slightly / strongly" (default true)'),
  weight: z.number().positive().optional(),
});

export const MultiSchema = z.strictObject({
  ...base,
  type: z.literal('multi'),
  options: z.array(z.strictObject({ id: Id, label: z.string().min(1) })).min(2),
  intensity: z.boolean().optional().describe('Rate each pick 1–5'),
  max: z.number().int().positive().optional(),
});

const ChallengeOptionSchema = OptionSchema.extend({
  reaction: z
    .enum(['hold', 'distinguish', 'yield'])
    .describe('hold: keeps the view; distinguish: names a relevant difference; yield: reconsiders'),
  revise: Ref.optional().describe('Re-ask this earlier item immediately'),
});

export const ChallengeSchema = z.strictObject({
  ...base,
  type: z.literal('challenge'),
  targets: Ref.describe('The earlier answer this challenge is aimed at'),
  scenario: z.string().min(1),
  source: z.string().min(1).optional().describe('Citation for the argument or thought experiment'),
  options: z.array(ChallengeOptionSchema).min(2),
  weight: z.number().positive().optional(),
});

export const ReaskSchema = z.strictObject({
  ...base,
  type: z.literal('reask'),
  target: Ref.describe('Re-asked when a challenge aimed at it was answered after the latest answer to it'),
});

export const AuthoredItemSchema = z.discriminatedUnion('type', [
  LikertSchema,
  SliderSchema,
  RatingSchema,
  ImportanceSchema,
  ChoiceSchema,
  PairSchema,
  MultiSchema,
  ChallengeSchema,
  ReaskSchema,
]);

export const EVIDENCE = ['validated', 'adapted', 'custom', 'for-fun'] as const;

export const TopicFileSchema = z.strictObject({
  id: Id,
  domain: Id,
  title: z.string().min(1),
  summary: z.string().min(1),
  tier: z.enum(['core', 'extended']),
  evidence: z.enum(EVIDENCE).describe('validated instrument, adapted from research, custom, or for fun'),
  source: z.string().min(1).optional().describe('Instrument or source citation'),
  license: z.string().min(1).optional(),
  instructions: z.string().min(1).optional().describe('Shown once before the first item'),
  sensitive: z.boolean().optional(),
  stance: Id.optional().describe('Item holding the overall position; challenges are checked against it'),
  importance: Id.optional().describe('Importance item; low importance skips deep items'),
  items: z.array(AuthoredItemSchema).min(1),
});

export const AXIS_FAMILIES = ['political', 'personality', 'values', 'worldview', 'taste'] as const;

export const AxisDefSchema = z.strictObject({
  id: Id,
  family: z.enum(AXIS_FAMILIES),
  title: z.string().min(1),
  description: z.string().min(1),
  poles: z.tuple([z.string().min(1), z.string().min(1)]).describe('[negative end, positive end]'),
  minWeight: z.number().positive().describe('Below this evidence weight the score is "not enough data"'),
  fullWeight: z.number().positive().describe('Evidence weight at which confidence reaches 1'),
  minTopics: z.number().int().positive().optional(),
  planned: z.boolean().optional().describe('Defined ahead of content; suppresses the unused-axis warning'),
});
export const AxesFileSchema = z.array(AxisDefSchema).min(1);

export const PrincipleDefSchema = z.strictObject({
  id: Id,
  label: z.string().min(1),
  definition: z.string().min(1),
});
export const PrinciplesFileSchema = z.array(PrincipleDefSchema).min(1);

export const DomainDefSchema = z.strictObject({
  id: Id,
  title: z.string().min(1),
  blurb: z.string().min(1),
  sensitive: z.boolean().optional(),
});
export const DomainsFileSchema = z.array(DomainDefSchema).min(1);

export const ConfigFileSchema = z.strictObject({
  deepMinImportance: z.number().min(0).max(1).describe('Importance (0–1) below which deep items are skipped'),
  tension: z.strictObject({
    minGap: z.number().positive().describe('Anchor gap (on the -1..1 scale) that counts as a tension'),
    minAnchorWeight: z.number().positive(),
  }),
  principleDefaults: z.strictObject({
    minWeight: z.number().positive(),
    fullWeight: z.number().positive(),
    minTopics: z.number().int().positive(),
  }),
  display: z.strictObject({
    mixedSpread: z.number().positive(),
    mixedScore: z.number().positive(),
  }),
});

export type AuthoredItem = z.infer<typeof AuthoredItemSchema>;
export type TopicFile = z.infer<typeof TopicFileSchema>;
export type AxisDef = z.infer<typeof AxisDefSchema>;
export type PrincipleDef = z.infer<typeof PrincipleDefSchema>;
export type DomainDef = z.infer<typeof DomainDefSchema>;
export type ConfigFile = z.infer<typeof ConfigFileSchema>;
