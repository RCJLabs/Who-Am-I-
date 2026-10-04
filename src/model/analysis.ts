// The analysis pack (content/analysis/): reference material the results analysis compares answers
// with. Political traditions are reference points, never labels; readings come from inside and
// outside each. Authored as YAML, compiled with the content but hashed and shipped separately.
// Strict objects, as in authored.ts; these schemas also generate schema/analysis/*.schema.json.
import { z } from 'zod';
import { ID_RE } from './authored.ts';
import type { AxisId, PrincipleId } from './content.ts';

const Id = z.string().regex(ID_RE, 'ids are snake_case: a-z, 0-9, _ (starting with a letter)');
const Position = z.number().min(-1).max(1);

/** Where a tradition sits, for balance checks only: never shipped or shown. */
export const SIDES = ['left', 'center', 'right'] as const;
export type Side = (typeof SIDES)[number];

export const READING_KINDS = ['book', 'essay', 'article', 'speech', 'lecture'] as const;
export type ReadingKind = (typeof READING_KINDS)[number];

export const TraditionSchema = z.strictObject({
  id: Id,
  name: z.string().min(1).describe('The name adherents use, e.g. "Social democracy"'),
  adherents: z.string().min(1).describe('Plural noun for adherents, lower case, e.g. "social democrats"'),
  side: z.enum(SIDES).describe('Left, center or right: used only to check balance, never shown'),
  summary: z.string().min(1).describe("What the tradition stands for, in its adherents' own terms"),
  positions: z
    .record(Id, Position)
    .describe('Position on every political spectrum, -1..1, scored from the answer sheet in tests/sim/traditions'),
  divided: z.array(Id).optional().describe('Spectrums or compared principles adherents split on; they count half'),
  principles: z.record(Id, Position).describe('Endorsement of every principle in the compare list, -1..1'),
  neighbours: z
    .array(
      z.strictObject({
        id: Id.describe('A nearby tradition'),
        split: z.string().min(1).describe('One line on what divides the two, fair to both'),
      }),
    )
    .min(1),
  inside: z.array(Id).min(1).describe('Readings voiced from inside this tradition, best first'),
  outside: z
    .array(Id)
    .min(1)
    .describe('Critiques from outside it, best first. The first comes from the other side (for a center tradition, the first two: one left, one right)'),
});

export const TraditionsFileSchema = z.strictObject({
  compare: z.array(Id).min(1).describe('Principles every tradition is placed on'),
  traditions: z.array(TraditionSchema).min(2),
});

export const ReadingSchema = z.strictObject({
  id: Id,
  author: z.string().min(1).describe('As on the title page'),
  title: z.string().min(1).describe('Verbatim'),
  year: z.number().int().min(1500).max(2100).describe('Year of first publication'),
  kind: z.enum(READING_KINDS),
  in: z.string().min(1).optional().describe('The book or journal an essay or article appeared in'),
  voice: Id.describe('The tradition the author writes from'),
  note: z.string().min(1).describe('One neutral line on what it argues'),
  about: z
    .strictObject({ axis: Id, toward: z.string().min(1).describe('A pole of that spectrum, as written in axes.yaml') })
    .optional()
    .describe('The pole it mainly argues for'),
});

export const ReadingsFileSchema = z.array(ReadingSchema).min(1);

export type TraditionsFile = z.infer<typeof TraditionsFileSchema>;
export type ReadingsFile = z.infer<typeof ReadingsFileSchema>;

// --- Compiled pack (what the app loads) ----------------------------------------------------------

export type TraditionId = string;
export type ReadingId = string;

export interface Tradition {
  id: TraditionId;
  name: string;
  adherents: string;
  summary: string;
  /** Every non-planned political spectrum. */
  positions: Record<AxisId, number>;
  /** Exactly the pack's compare list. */
  principles: Record<PrincipleId, number>;
  /** Spectrums and principles adherents split on. */
  divided: string[];
  neighbours: { id: TraditionId; split: string }[];
  inside: ReadingId[];
  outside: ReadingId[];
}

export interface Reading {
  id: ReadingId;
  author: string;
  title: string;
  year: number;
  kind: ReadingKind;
  in?: string;
  voice: TraditionId;
  note: string;
  /** The pole it mainly argues for: 0 = the axis's first pole, 1 = its second. */
  about?: { axis: AxisId; pole: 0 | 1 };
}

export interface AnalysisPack {
  format: 'whoami.analysis';
  schema: 1;
  /** Hash of the pack alone; editing the pack never changes the content version. */
  version: string;
  compare: PrincipleId[];
  /** In authored order, which also breaks ties. */
  traditions: Tradition[];
  readings: Record<ReadingId, Reading>;
}
