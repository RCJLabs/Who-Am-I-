// Loaded terms (content/loaded-terms.txt): words that signal a side. The lint (W108) and the copy
// tests share this matcher, so a term is found the same way in content and in app wording.

export interface TermMatcher {
  term: string;
  re: RegExp;
}

/** One term per line; blank lines and # comments are ignored. */
export function parseTerms(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

/** Whole-word, case-insensitive matchers. */
export function termMatchers(terms: readonly string[]): TermMatcher[] {
  return terms.map((term) => ({ term, re: new RegExp(`(^|[^a-z0-9])${escapeRe(term)}($|[^a-z0-9])`, 'i') }));
}

/** The loaded terms found in `text`. */
export function findTerms(text: string, matchers: readonly TermMatcher[]): string[] {
  return matchers.filter((m) => m.re.test(text)).map((m) => m.term);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
