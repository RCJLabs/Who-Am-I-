// The analysis pack (content/analysis/): reference material the results analysis compares answers
// with. Political traditions are reference points, never labels; readings come from inside and
// outside each. Each tradition is placed by an answer sheet: the app's own questions answered as
// a thoughtful adherent would, scored by the engine like anyone's answers, so no position is ever
// written by hand. Personal suggestions are invitations, each tied to a published association and
// the self-description it rests on, never advice. Authored as YAML, compiled with the content but
// hashed and shipped separately. Strict objects, as in authored.ts; these schemas also generate
// schema/analysis/*.schema.json.
import { z } from 'zod';
import { ID_RE } from './authored.ts';
import type { AxisId, Cond, ItemId, PrincipleId } from './content.ts';

const Id = z.string().regex(ID_RE, 'ids are snake_case: a-z, 0-9, _ (starting with a letter)');
const QuestionId = z.string().regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/, 'questions are written topic.item');

/** Where a tradition sits, for balance checks only: never shipped or shown. */
export const SIDES = ['left', 'center', 'right'] as const;
export type Side = (typeof SIDES)[number];

export const READING_KINDS = ['book', 'essay', 'article', 'speech', 'lecture'] as const;
export type ReadingKind = (typeof READING_KINDS)[number];

/** What a personal suggestion is about; at most one of each is shown. */
export const SUGGESTION_KINDS = ['work', 'activity', 'learning', 'social'] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const TraditionSchema = z.strictObject({
  id: Id,
  name: z.string().min(1).describe('The name adherents use, e.g. "Social democracy"'),
  adherents: z.string().min(1).describe('Plural noun for adherents, lower case, e.g. "social democrats"'),
  side: z.enum(SIDES).describe('Left, center or right: used only to check balance, never shown'),
  summary: z.string().min(1).describe("What the tradition stands for, in its adherents' own terms"),
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

/** One file per tradition in content/analysis/sheets/. */
export const SheetSchema = z.strictObject({
  tradition: Id.describe('The tradition this sheet places'),
  sources: z
    .array(z.string().min(1))
    .min(1)
    .describe('The writers the answers draw on, e.g. "Eduard Bernstein, The Preconditions of Socialism (1899)"'),
  answers: z
    .record(QuestionId, z.number().int().min(1).max(7))
    .describe('The step a thoughtful adherent would choose, by question (topic.item)'),
  divided: z.array(QuestionId).optional().describe("Questions the tradition's adherents split on, listed instead of answered"),
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

export const SuggestionSchema = z.strictObject({
  id: Id,
  kind: z.enum(SUGGESTION_KINDS).describe('At most one suggestion of each kind is shown'),
  when: z
    .string()
    .min(1)
    .describe('Who it applies to: personality, values or thinking spectrums, each compared toward a pole and joined with "and", e.g. "extraversion < -0.25"'),
  title: z.string().min(1).describe('A few words on what is suggested'),
  text: z.string().min(1).describe('One sentence on the published association, as a tendency, never as advice'),
  source: z.string().min(1).describe('The study or meta-analysis the association comes from'),
});

export const SuggestionsFileSchema = z.array(SuggestionSchema).min(1);

export type TraditionsFile = z.infer<typeof TraditionsFileSchema>;
export type ReadingsFile = z.infer<typeof ReadingsFileSchema>;
export type SheetFile = z.infer<typeof SheetSchema>;
export type SuggestionsFile = z.infer<typeof SuggestionsFileSchema>;

// --- Compiled pack (what the app loads) ----------------------------------------------------------

export type TraditionId = string;
export type ReadingId = string;
export type SuggestionId = string;

export interface Tradition {
  id: TraditionId;
  name: string;
  adherents: string;
  summary: string;
  /** Every non-planned political spectrum, scored from the answer sheet. */
  positions: Record<AxisId, number>;
  /** Exactly the pack's compare list, scored from the answer sheet. */
  principles: Record<PrincipleId, number>;
  /** Spectrums and principles adherents split on: split questions carry half the weight or more. */
  divided: string[];
  /** The sheet's answers to the political questions, as values -1..1; split questions left out. */
  answers: Record<ItemId, number>;
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

export interface Suggestion {
  id: SuggestionId;
  kind: SuggestionKind;
  /** Comparisons of spectrum scores, joined with "and". */
  when: Cond;
  /** Each spectrum the rule relies on and the pole it points to: 0 = the axis's first pole, 1 = its second. */
  basis: { axis: AxisId; pole: 0 | 1 }[];
  title: string;
  text: string;
  source: string;
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
  /** In authored order, which breaks ties. Empty when the pack has none. */
  suggestions: Suggestion[];
}
