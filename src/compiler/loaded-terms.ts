// Loaded terms (content/loaded-terms.txt): words that signal a side. The lint (W108) and the copy
// tests share this matcher, so a term is found the same way in content and in app wording. The
// blocked-advice list (content/analysis/blocked-advice.txt) uses it too, matching other forms.

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

/** Endings that make another form of a word: "saving" also finds "savings", "parent" finds "parenting". */
const INFLECTIONS = 's|es|ed|ing|er|ers|al|ful|ist';

/**
 * Whole-word, case-insensitive matchers. With `inflected`, a term's last word also matches with a
 * common ending added (for blocked subjects, where any form of the word counts).
 */
export function termMatchers(terms: readonly string[], { inflected = false } = {}): TermMatcher[] {
  const end = inflected ? `(?:${INFLECTIONS})?` : '';
  return terms.map((term) => ({ term, re: new RegExp(`(^|[^a-z0-9])${escapeRe(straight(term))}${end}($|[^a-z0-9])`, 'i') }));
}

/** The terms found in `text`. Curly apostrophes count as straight ones. */
export function findTerms(text: string, matchers: readonly TermMatcher[]): string[] {
  const t = straight(text);
  return matchers.filter((m) => m.re.test(t)).map((m) => m.term);
}

function straight(s: string): string {
  return s.replace(/[\u2018\u2019]/g, "'");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
