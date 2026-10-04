// Personal suggestions (content/analysis/suggestions.yaml): who each one applies to, and whether it
// stays within what the app may suggest. A rule may read only how people describe themselves
// (personality, values, how they think), never their politics, beliefs or anything sensitive, and
// never neuroticism. Each comparison points toward a pole, so a suggestion can say what it rests
// on ("Because you described yourself as more “Reserved”") and never fires for answers near the
// middle. Every pole a rule relies on needs a rule on the opposite pole, so neither reads as better.
import { parseCond } from '../engine/cond/parse.ts';
import type { Suggestion, SuggestionsFile } from '../model/analysis.ts';
import type { Cond } from '../model/content.ts';
import type { Env, Loc, Reporter } from './context.ts';
import { findTerms, termMatchers } from './loaded-terms.ts';
import type { ParsedFile } from './yaml.ts';

/** Families a suggestion may rest on. */
const FAMILIES: ReadonlySet<string> = new Set(['personality', 'values', 'thinking']);
/** Never a basis: suggestions from it would read as advice about anxiety or mood. */
const NEVER: ReadonlySet<string> = new Set(['neuroticism']);
/** How far toward a pole every comparison must point. */
export const MIN_THRESHOLD = 0.25;
/** Wording the analysis never uses (docs/ANALYSIS.md, Wording rules). */
const PRESCRIPTIVE = [/\byou should\b/i, /\byou must\b/i, /\byou are an? \b/i, /\bmost people\b/i, /\bnormal\b/i, /\bwrong\b/i, /%/];

type Cmp = Extract<Cond, { op: 'cmp' }>;

/**
 * Compiles each suggestion's rule and checks its scope (E006, E016), wording (E016) and pole balance
 * (W113). Null if any suggestion has an error.
 */
export function compileSuggestions(g: { pf: ParsedFile; file: SuggestionsFile }, env: Env, rep: Reporter): Suggestion[] | null {
  const errors = rep.errors;
  const blocked = termMatchers(env.blockedAdvice);
  const out: Suggestion[] = [];
  g.file.forEach((s, i) => {
    const at = (...path: (string | number)[]): Loc => ({ pf: g.pf, path: [i, ...path] });
    for (const field of ['title', 'text'] as const) {
      for (const term of findTerms(s[field], blocked)) rep.report('E016', `"${term}" is a subject suggestions never touch: describe a kind of work, activity, learning or company instead`, at(field));
      for (const re of PRESCRIPTIVE) {
        const m = s[field].match(re);
        if (m) rep.report('E016', `"${m[0]}" prescribes, labels or compares: describe the association as a tendency instead`, at(field));
      }
    }
    if (/^original\b/i.test(s.source.trim())) rep.report('E016', 'Cite the published study or meta-analysis the association comes from', at('source'));

    const basis = ruleBasis(s.when, env, at('when'), rep);
    if (!basis) return;
    out.push({ id: s.id, kind: s.kind, when: basis.cond, basis: basis.poles, title: s.title, text: s.text, source: s.source });
  });
  if (rep.errors > errors) return null;
  balance(g, out, env, rep);
  return out;
}

/** The rule as a condition, and the pole each comparison points to; null after reporting a problem. */
function ruleBasis(src: string, env: Env, loc: Loc, rep: Reporter): { cond: Cond; poles: Suggestion['basis'] } | null {
  const parsed = parseCond(src);
  if (!parsed.ok) {
    rep.report('E006', `Condition: ${parsed.message}`, { ...loc, colOffset: parsed.col });
    return null;
  }
  const cmps: Cmp[] = [];
  const flatten = (c: Cond): boolean => {
    if (c.op === 'and') return c.args.every(flatten);
    if (c.op !== 'cmp') return false;
    cmps.push(c);
    return true;
  };
  if (!flatten(parsed.cond)) {
    rep.report('E016', "A suggestion's rule compares spectrums with numbers, joined with 'and' only", loc);
    return null;
  }
  const uses = parsed.uses.filter((u) => u.use === 'cmp');
  const poles: Suggestion['basis'] = [];
  let ok = true;
  cmps.forEach((c, k) => {
    const at: Loc = { ...loc, colOffset: uses[k]?.col ?? 0 };
    const axis = env.axes.get(c.ref);
    if (!axis) {
      rep.report('E004', `Unknown spectrum '${c.ref}'`, at);
      ok = false;
      return;
    }
    if (!FAMILIES.has(axis.family) || NEVER.has(axis.id)) {
      const allowed = [...FAMILIES].join(', ');
      rep.report('E016', NEVER.has(axis.id) ? `Suggestions never rest on '${axis.id}'` : `Suggestions rest only on ${allowed} spectrums; '${axis.id}' is ${axis.family}`, at);
      ok = false;
      return;
    }
    const toward = c.cmp === '<' || c.cmp === '<=' ? 0 : c.cmp === '>' || c.cmp === '>=' ? 1 : null;
    const far = toward === 0 ? c.value <= -MIN_THRESHOLD : toward === 1 ? c.value >= MIN_THRESHOLD : false;
    if (toward === null || !far) {
      rep.report('E016', `Compare toward a pole, at least ${MIN_THRESHOLD} from the middle: '${c.ref} < -${MIN_THRESHOLD}' or '${c.ref} > ${MIN_THRESHOLD}'`, at);
      ok = false;
      return;
    }
    if (poles.some((p) => p.axis === axis.id)) {
      rep.report('E016', `'${axis.id}' is compared twice`, at);
      ok = false;
      return;
    }
    poles.push({ axis: axis.id, pole: toward });
  });
  return ok ? { cond: parsed.cond, poles } : null;
}

/** W113: a pole with suggestions and its opposite without, so one end reads as the better one. */
function balance(g: { pf: ParsedFile; file: SuggestionsFile }, list: Suggestion[], env: Env, rep: Reporter): void {
  const used = new Map<string, number>();
  list.forEach((s, i) => {
    for (const b of s.basis) if (!used.has(`${b.axis}:${b.pole}`)) used.set(`${b.axis}:${b.pole}`, i);
  });
  for (const [key, i] of used) {
    const [axis, pole] = key.split(':') as [string, string];
    if (used.has(`${axis}:${1 - Number(pole)}`)) continue;
    const poles = env.axes.get(axis)!.poles;
    rep.report(
      'W113',
      `Only “${poles[Number(pole)]}” on '${axis}' has suggestions: add one toward “${poles[1 - Number(pole)]}” so neither reads as the better one`,
      { pf: g.pf, path: [i, 'when'] },
    );
  }
}
