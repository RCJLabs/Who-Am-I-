// Links from research (content/analysis/suggestions.yaml): published associations between a
// personality trait and an interest, each written from both ends, and the norms that gate them.
// A link runs on one Big Five trait, never neuroticism, with an uncorrected correlation of at
// least 0.20. Its wording names activities, never a kind of person: no subject from the
// blocked-advice list in any form, no second person, nothing prescriptive, no numbers, nothing
// double-ended, and none of the trait's own item words. Norms convert to the app's units here.
import type { Suggestion, SuggestionsFile, TraitNorm } from '../model/analysis.ts';
import type { Bundle } from '../model/content.ts';
import type { Env, Loc, Reporter } from './context.ts';
import { findTerms, termMatchers } from './loaded-terms.ts';
import type { ParsedFile } from './yaml.ts';

/** Never a basis: links from it would read as advice about anxiety or mood. */
const NEVER: ReadonlySet<string> = new Set(['neuroticism']);
/** The evidence bar: the typical size of an individual-differences effect. */
export const MIN_R = 0.2;
/** From here, "somewhat more"; below, "a little more". */
export const SOMEWHAT_R = 0.3;
/** Wording a link never uses: the second person, prescriptions, numbers, and double-ended phrases. */
const WORDING: [RegExp, string][] = [
  [/\b(you|your|yours|yourself)\b/i, 'speaks to the reader'],
  [/\b(should|ought|must|need to|needs to|have to|has to)\b/i, 'prescribes'],
  [/[0-9%]|\bpercent\b|\btwice\b|\btimes as\b/i, 'gives a number'],
  [/\bat times\b|\bbut also\b|\bboth\b/i, 'is double-ended, so it fits anyone'],
  [/\b(most people|normal|wrong)\b/i, 'compares or judges'],
];

/** Checks each link and the norms (E004, E016) and compiles both. Null if anything has an error. */
export function compileSuggestions(
  g: { pf: ParsedFile; file: SuggestionsFile },
  env: Env,
  b: Bundle,
  rep: Reporter,
): { suggestions: Suggestion[]; norms: Record<string, TraitNorm> } | null {
  const errors = rep.errors;
  const items = new Map(b.topics.flatMap((t) => t.items.map((it) => [it.id, it] as const)));
  /** The weight with which a question (topic.item) feeds a spectrum, if it does. */
  const itemWeight = (id: string, axis: string): number | undefined => {
    const it = items.get(id);
    return it && 'effects' in it ? it.effects.find((e) => e.target === `axis:${axis}`)?.w : undefined;
  };
  const blocked = termMatchers(env.blockedAdvice, { inflected: true });
  const norms: Record<string, TraitNorm> = {};

  for (const [trait, n] of Object.entries(g.file.norms.traits)) {
    const at = (...path: (string | number)[]): Loc => ({ pf: g.pf, path: ['norms', 'traits', trait, ...path] });
    const axis = env.axes.get(trait);
    if (!axis) {
      rep.report('E004', `Unknown spectrum '${trait}'`, at());
      continue;
    }
    if (axis.family !== 'personality' || NEVER.has(trait)) rep.report('E016', `Links rest only on personality spectrums other than neuroticism; '${trait}' isn't one`, at());
    if (n.mean < 1 || n.mean > 5) rep.report('E016', `A mean on the items' 1-5 scale, not ${n.mean}`, at('mean'));
    const reversals: [string, string][] = [];
    (n.reversals ?? []).forEach((pair, k) => {
      const ws = pair.map((id) => itemWeight(id, trait));
      if (ws.some((w) => w === undefined)) {
        rep.report('E004', `Both items must be questions that feed '${trait}': ${pair.join(', ')}`, at('reversals', k));
      } else if (Math.sign(ws[0]!) === Math.sign(ws[1]!)) {
        rep.report('E016', `A reversal pairs items keyed in opposite directions; ${pair.join(' and ')} aren't`, at('reversals', k));
      } else reversals.push(pair);
    });
    // The items' 1-5 scale in the app's units: step 3 is 0, each step 0.5.
    norms[trait] = { mean: Math.round(((n.mean - 3) / 2) * 1e4) / 1e4, sd: Math.round((n.sd / 2) * 1e4) / 1e4, reversals };
  }

  const out: Suggestion[] = [];
  g.file.suggestions.forEach((s, i) => {
    const at = (...path: (string | number)[]): Loc => ({ pf: g.pf, path: ['suggestions', i, ...path] });
    const axis = env.axes.get(s.trait);
    if (!axis) {
      rep.report('E004', `Unknown spectrum '${s.trait}'`, at('trait'));
      return;
    }
    if (axis.family !== 'personality' || NEVER.has(s.trait)) rep.report('E016', `Links rest only on personality spectrums other than neuroticism; '${s.trait}' isn't one`, at('trait'));
    else if (!g.file.norms.traits[s.trait]) rep.report('E016', `No norms for '${s.trait}': add them under norms.traits`, at('trait'));
    const toward = axis.poles.indexOf(s.toward);
    if (toward !== 0 && toward !== 1) rep.report('E004', `'${s.toward}' isn't a pole of '${axis.id}' (${axis.poles.join(' or ')})`, at('toward'));
    if (s.r < MIN_R) rep.report('E016', `r = ${s.r} is under the evidence bar of ${MIN_R}`, at('r'));
    if (/^original\b/i.test(s.source.trim())) rep.report('E016', 'Cite the published study or meta-analysis the association comes from', at('source'));
    const echo = termMatchers(g.file.norms.traits[s.trait]?.echo ?? [], { inflected: true });
    for (const field of ['title', 'away', 'interest'] as const) {
      for (const term of findTerms(s[field], blocked)) rep.report('E016', `"${term}" is a subject links never touch: name the activity instead`, at(field));
      for (const term of findTerms(s[field], echo)) rep.report('E016', `"${term}" restates the trait's own questions`, at(field));
      for (const [re, why] of WORDING) {
        const m = s[field].match(re);
        if (m) rep.report('E016', `"${m[0]}" ${why}: name the activity, as a tendency`, at(field));
      }
    }
    if (toward === 0 || toward === 1) {
      out.push({
        id: s.id,
        kind: s.kind,
        trait: s.trait,
        toward,
        strength: s.r >= SOMEWHAT_R ? 'somewhat' : 'little',
        outcome: s.outcome,
        interest: s.interest,
        title: s.title,
        away: s.away,
        source: s.source,
      });
    }
  });
  return rep.errors > errors ? null : { suggestions: out, norms };
}

