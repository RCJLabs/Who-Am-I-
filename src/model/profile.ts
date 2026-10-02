// The Profile is the public contract with the future game and any other consumer. Within
// profileVersion 1, changes are additive only; consumers must ignore unknown keys.
// docs/profile.schema.json is generated from this file (npm run schemas).
import { z } from 'zod';
import { AXIS_FAMILIES, EVIDENCE } from './authored.ts';

const ScoredSchema = z.object({
  score: z.number().min(-1).max(1).nullable().describe('-1..1 between the two poles; null = not enough data'),
  confidence: z.number().min(0).max(1),
  weight: z.number().min(0).describe('Total evidence weight behind the score'),
  spread: z.number().min(0).describe('Weighted standard deviation of the evidence'),
  topics: z.number().int().min(0).describe('Number of topics contributing'),
});

const AxisResultSchema = ScoredSchema.extend({ family: z.enum(AXIS_FAMILIES) });

const PrincipleResultSchema = ScoredSchema.extend({
  byTopic: z.record(z.string(), z.number()).describe('Endorsement of the principle within each topic'),
  consistency: z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .describe('1 = applied the same way across topics (anchor items only); null with fewer than 2 topics'),
});

const MoveSchema = z.object({
  source: z.string().describe('Challenge or re-ask item that prompted the change'),
  delta: z.number().describe('Change in normalized value (-2..2)'),
  steps: z.number().nullable().describe('Change in scale steps, for scale items'),
});

const TopicResultSchema = z.object({
  stance: z.number().nullable(),
  stanceLabel: z.string().nullable(),
  initialStance: z.number().nullable(),
  importance: z.number().min(0).max(1).nullable(),
  complete: z.boolean(),
  circumstances: z.record(z.string(), z.number()),
  challenges: z.object({
    asked: z.number().int(),
    held: z.number().int(),
    distinguished: z.number().int(),
    moved: z.number().int(),
    moves: z.array(MoveSchema),
  }),
});

const TensionSummarySchema = z.object({
  key: z.string(),
  principle: z.string(),
  topics: z.tuple([z.string(), z.string()]),
  gap: z.number(),
  status: z.enum(['open', 'distinguished', 'revised', 'acknowledged']),
  reason: z.string().optional(),
});

export const ProfileSchema = z.object({
  format: z.literal('whoami.profile'),
  profileVersion: z.literal(1),
  contentVersion: z.string(),
  appVersion: z.string(),
  generatedAt: z.string(),
  scope: z.object({
    sensitiveIncluded: z.boolean(),
    topics: z.array(z.string()).describe('Topics with at least one answer that are included'),
  }),
  axes: z.record(z.string(), AxisResultSchema),
  principles: z.record(z.string(), PrincipleResultSchema),
  topics: z.record(z.string(), TopicResultSchema),
  interests: z.record(z.string(), z.number().min(0).max(1)).describe('"topic.option" → 0..1 intensity'),
  identity: z
    .record(z.string(), z.union([z.string(), z.array(z.string())]))
    .optional()
    .describe('Self-reported, opt-in; present only when sensitive answers are included'),
  tensions: z.array(TensionSummarySchema),
  evidence: z.record(z.string(), z.enum(EVIDENCE)),
  completeness: z.object({
    answered: z.number().int().describe('Items with a value-bearing answer'),
    orphaned: z.number().int().describe('Stored answers that no longer match current content'),
  }),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Scored = z.infer<typeof ScoredSchema>;
export type TopicResult = z.infer<typeof TopicResultSchema>;
export type TensionSummary = z.infer<typeof TensionSummarySchema>;
