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
  W101: 'keying-balance',
  W102: 'cross-topic-ref',
  W103: 'unproven-reachability',
  W104: 'no-middle-challenge',
  W105: 'challenge-source',
  W106: 'option-no-effects',
  W107: 'unused-or-single-anchor',
  W108: 'loaded-term',
  W109: 'anchor-cross-load',
};
