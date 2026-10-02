// Answers are an append-only event log. These schemas validate backups on import, so they use
// non-strict objects: a backup from a newer app version still imports (unknown keys are dropped).
import { z } from 'zod';

export const ResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('scale'), step: z.number().int().min(1).max(11) }),
  z.object({
    kind: z.literal('option'),
    option: z.string().min(1),
    strength: z.union([z.literal(1), z.literal(2)]).optional(),
  }),
  z.object({
    kind: z.literal('multi'),
    picks: z.record(z.string(), z.union([z.number().int().min(1).max(5), z.literal(true)])),
  }),
  z.object({ kind: z.literal('skip') }),
  z.object({ kind: z.literal('unsure') }),
  z.object({ kind: z.literal('declined') }),
]);
export type Response = z.infer<typeof ResponseSchema>;

export const ViaSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('challenge'), source: z.string() }),
  z.object({ kind: z.literal('reask'), source: z.string() }),
  z.object({ kind: z.literal('tension'), source: z.string() }),
  z.object({ kind: z.literal('manual') }),
]);
export type Via = z.infer<typeof ViaSchema>;

export const AnswerEventSchema = z.object({
  /** Monotonic, lexicographically sortable id (ULID in the app). Defines event order; `at` is informational. */
  id: z.string().min(1),
  item: z.string().min(1),
  r: ResponseSchema,
  at: z.number(),
  /** contentVersion when answered. */
  cv: z.string(),
  via: ViaSchema.optional(),
  /** Optional free-text reason. Never included in share codes. */
  note: z.string().max(2000).optional(),
});
export type AnswerEvent = z.infer<typeof AnswerEventSchema>;

export const DISTINCTION_REASONS = ['harm_to_others', 'consent', 'stakes', 'other_principle', 'other'] as const;

export const TensionResolutionSchema = z.object({
  id: z.string().min(1),
  /** principle|topicA|topicB with topic ids sorted. */
  key: z.string().min(1),
  at: z.number(),
  kind: z.enum(['distinguished', 'revised', 'acknowledged']),
  reason: z.enum(DISTINCTION_REASONS).optional(),
  principle: z.string().optional(),
  text: z.string().max(2000).optional(),
  /** Anchor event ids at resolution time; if they change, the tension can reopen. */
  basis: z.array(z.string()),
});
export type TensionResolution = z.infer<typeof TensionResolutionSchema>;

export const SettingsSchema = z.object({
  alwaysDeep: z.boolean(),
  lastBackupAt: z.number().nullable(),
  seed: z.string(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const BackupSchema = z.object({
  format: z.literal('whoami.backup'),
  version: z.literal(1),
  exportedAt: z.string(),
  appVersion: z.string(),
  contentVersion: z.string(),
  events: z.array(AnswerEventSchema),
  resolutions: z.array(TensionResolutionSchema),
  settings: SettingsSchema.partial().optional(),
});
export type Backup = z.infer<typeof BackupSchema>;

export function isValueBearing(r: Response): boolean {
  return r.kind === 'scale' || r.kind === 'option' || r.kind === 'multi';
}
