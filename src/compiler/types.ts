export type Severity = 'error' | 'warning';

export interface Diagnostic {
  code: string;
  severity: Severity;
  message: string;
  file: string;
  line: number;
  col: number;
}

export interface SourceFile {
  /** Repo-relative path with forward slashes (used in messages and CI annotations). */
  path: string;
  text: string;
}

export interface ContentSources {
  config: SourceFile;
  domains: SourceFile;
  axes: SourceFile;
  principles: SourceFile;
  topics: SourceFile[];
  loadedTerms?: SourceFile;
  /** Party and politician names the analysis pack must not use (W112). */
  namedPolitics?: SourceFile;
  /** content/analysis/: reference material for the results analysis. Optional: no pack, no feature. */
  analysis?: AnalysisSources;
}

export interface AnalysisSources {
  traditions?: SourceFile;
  readings?: SourceFile;
  /** One answer sheet per tradition (content/analysis/sheets/). */
  sheets?: SourceFile[];
  /** Personal suggestions (optional): no file, no suggestions. */
  suggestions?: SourceFile;
  /** Terms loaded only when describing political traditions ("moderate", "mainstream"): checked in the pack on top of loadedTerms. */
  loadedTerms?: SourceFile;
  /** Subjects a personal suggestion must never touch ("diet", "debt", "dating"): E016. */
  blockedAdvice?: SourceFile;
}

/** Rule codes. Errors fail the build; warnings are budgeted by --max-warnings. */
export const RULES: Readonly<Record<string, string>> = {
  E001: 'yaml-syntax',
  E002: 'schema',
  E003: 'duplicate-id',
  E004: 'unresolved-ref',
  E005: 'forward-ref',
  E006: 'condition',
  E007: 'unreachable',
  E008: 'challenge-symmetry',
  E009: 'challenge-contract',
  E010: 'stance-importance',
  E011: 'option-values',
  E012: 'sensitivity',
  E013: 'anchor-keying',
  E014: 'tradition-balance',
  E015: 'answer-sheet',
  E016: 'suggestion-scope',
  W101: 'keying-balance',
  W102: 'cross-topic-ref',
  W103: 'unproven-reachability',
  W104: 'no-middle-challenge',
  W105: 'challenge-source',
  W106: 'option-no-effects',
  W107: 'unused-or-single-anchor',
  W108: 'loaded-term',
  W109: 'anchor-cross-load',
  W110: 'lopsided-options',
  W111: 'reading-balance',
  W112: 'named-politics',
  W113: 'suggestion-balance',
};
