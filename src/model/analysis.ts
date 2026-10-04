// The analysis pack (content/analysis/): reference material the results analysis compares answers
// with. Political traditions are reference points, never labels; readings come from inside and
// outside each. Each tradition is placed by an answer sheet: the app's own questions answered as
// a thoughtful adherent would, scored by the engine like anyone's answers, so no position is ever
// written by hand. Links from research (suggestions) report one published association between a
// personality trait and an interest, from both ends, gated by published norms; never advice.
// Authored as YAML, compiled with the content but hashed and shipped separately. Strict objects, as
// in authored.ts; these schemas also generate schema/analysis/*.schema.json.
import { z } from 'zod';
import { ID_RE } from './authored.ts';
import type { AxisId, ItemId, PrincipleId } from './content.ts';

const Id = z.string().regex(ID_RE, 'ids are snake_case: a-z, 0-9, _ (starting with a letter)');
const QuestionId = z.string().regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/, 'questions are written topic.item');

/** Where a tradition sits, for balance checks only: never shipped or shown. */
export const SIDES = ['left', 'center', 'right'] as const;
export type Side = (typeof SIDES)[number];

export const READING_KINDS = ['book', 'essay', 'article', 'speech', 'lecture'] as const;
export type ReadingKind = (typeof READING_KINDS)[number];

/** What a link from research is about: ways of working, free time, subjects to explore. At most one of each is shown. */
export const SUGGESTION_KINDS = ['working', 'free_time', 'subjects'] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

/** What the source measured: how much interest people report, or how often they take part. */
export const SUGGESTION_OUTCOMES = ['interest', 'participation'] as const;
export type SuggestionOutcome = (typeof SUGGESTION_OUTCOMES)[number];

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

/** One published association between a personality trait and an interest, written from both ends. */
export const SuggestionSchema = z.strictObject({
  id: Id,
  kind: z.enum(SUGGESTION_KINDS).describe('At most one of each kind is shown'),
  trait: Id.describe('The personality spectrum the association runs on (never neuroticism)'),
  toward: z.string().min(1).describe('The pole whose answers report more interest, as written in axes.yaml'),
  r: z.number().min(0).max(1).describe('Uncorrected correlation from the source; at least 0.20. Under 0.30 reads "a little", from 0.30 "somewhat"'),
  outcome: z.enum(SUGGESTION_OUTCOMES).describe('Whether the source measured interest or voluntary participation'),
  interest: z.string().min(1).describe('What the source measured, as a noun phrase: "artistic activities, such as drawing, design, writing or music"'),
  title: z.string().min(1).describe('The end with more interest, as a noun phrase naming the activity'),
  away: z.string().min(1).describe('The other end: the same activity playing a small part, never a deficit'),
  source: z.string().min(1).describe('The meta-analysis or large replicated study'),
});

/** Published adult norms for each trait, on its items' own scale (1 to 5): used only to gate, never shown. */
export const NormsSchema = z.strictObject({
  source: z.string().min(1).describe('Where the norms come from'),
  traits: z.record(
    Id,
    z.strictObject({
      mean: z.number().describe('Mean of the 4 items, on their 1-5 scale'),
      sd: z.number().positive(),
      reversals: z
        .array(z.tuple([QuestionId, QuestionId]))
        .optional()
        .describe('Pairs of items that say opposite things: agreeing with both voids the trait'),
      echo: z.array(z.string().min(1)).optional().describe("Words from the trait's own items, which a link must not restate"),
    }),
  ),
});

export const SuggestionsFileSchema = z.strictObject({
  norms: NormsSchema,
  suggestions: z.array(SuggestionSchema).min(1),
});

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
  trait: AxisId;
  /** The pole whose answers report more interest: 0 = the axis's first pole, 1 = its second. */
  toward: 0 | 1;
  /** From the correlation: under 0.30 "a little", from 0.30 "somewhat". */
  strength: 'little' | 'somewhat';
  outcome: SuggestionOutcome;
  interest: string;
  title: string;
  away: string;
  source: string;
}

/** A trait's published norms in the app's units (-1..1), and the item pairs that void it. */
export interface TraitNorm {
  mean: number;
  sd: number;
  reversals: [ItemId, ItemId][];
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
  /** Norms for every trait a suggestion reads. */
  norms: Record<AxisId, TraitNorm>;
}
