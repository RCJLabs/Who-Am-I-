// The analysis pack (content/analysis/): political traditions, the answer sheets that place
// them, the readings the results analysis offers, and personal suggestions. Compiled with the
// content, so it's checked against the same spectrums, principles and word lists, but hashed on
// its own: editing it never changes contentVersion.
import { createHash } from 'node:crypto';
import {
  ReadingsFileSchema,
  SheetSchema,
  SuggestionsFileSchema,
  TraditionsFileSchema,
  type AnalysisPack,
  type Reading,
  type ReadingsFile,
  type SheetFile,
  type SuggestionsFile,
  type Tradition,
  type TraditionsFile,
} from '../model/analysis.ts';
import type { Bundle } from '../model/content.ts';
import type { Env, Loc, Reporter } from './context.ts';
import { packRules, positionRules } from './rules/analysis.ts';
import { scoreSheet, type SheetTargets } from './sheets.ts';
import { compileSuggestions } from './suggestions.ts';
import type { AnalysisSources } from './types.ts';
import { canonicalJson, checkUnique, validate } from './validate.ts';
import { parseYaml, type ParsedFile } from './yaml.ts';

export interface ParsedPack {
  traditions: { pf: ParsedFile; file: TraditionsFile };
  readings: { pf: ParsedFile; file: ReadingsFile };
  sheets: { pf: ParsedFile; file: SheetFile }[];
  /** Optional: a pack without suggestions has none. */
  suggestions: { pf: ParsedFile; file: SuggestionsFile } | null;
}

/** Parses and validates the pack's files. Null when there is no pack, or it doesn't validate. */
export function parsePack(src: AnalysisSources | undefined, rep: Reporter): ParsedPack | null {
  if (!src || (!src.traditions && !src.readings && !src.sheets?.length && !src.suggestions)) return null;
  const tpf = src.traditions ? parseYaml(src.traditions, rep.diagnostics) : null;
  const rpf = src.readings ? parseYaml(src.readings, rep.diagnostics) : null;
  const gpf = src.suggestions ? parseYaml(src.suggestions, rep.diagnostics) : null;
  const traditions = tpf && validate(tpf, TraditionsFileSchema, rep);
  const readings = rpf && validate(rpf, ReadingsFileSchema, rep);
  const suggestions = gpf && validate(gpf, SuggestionsFileSchema, rep);
  const sheets = (src.sheets ?? []).map((f) => {
    const pf = parseYaml(f, rep.diagnostics);
    const file = pf && validate(pf, SheetSchema, rep);
    return pf && file ? { pf, file } : null;
  });
  if (!src.traditions || !src.readings) {
    const pf = tpf ?? rpf ?? sheets.find((x) => x)?.pf ?? gpf;
    if (pf) rep.report('E002', 'The analysis pack needs both traditions.yaml and readings.yaml', { pf, path: [] });
    return null;
  }
  if (!tpf || !rpf || !traditions || !readings || sheets.some((x) => !x) || (src.suggestions && !suggestions)) return null;
  return {
    traditions: { pf: tpf, file: traditions },
    readings: { pf: rpf, file: readings },
    sheets: sheets.filter((x) => x !== null),
    suggestions: gpf && suggestions ? { pf: gpf, file: suggestions } : null,
  };
}

/** References, duplicates and the pack rules that don't need the compiled content. */
export function checkPack(p: ParsedPack, env: Env, rep: Reporter): void {
  checkReferences(p, env, rep);
  packRules({ pack: p, env, rep });
}

/**
 * Scores each tradition's answer sheet with the engine, checks the balance of the positions that
 * gives, checks the links from research against the items they read, and builds the pack the app
 * loads. Null if any sheet or link has errors.
 */
export function compilePack(p: ParsedPack, b: Bundle, env: Env, rep: Reporter): AnalysisPack | null {
  const compare = p.traditions.file.compare;
  const targets = new Map<string, SheetTargets>();
  for (const sheet of p.sheets) {
    const t = scoreSheet(b, env, sheet, compare, rep);
    if (t) targets.set(sheet.file.tradition, t);
  }
  const list = p.traditions.file.traditions;
  const links = p.suggestions ? compileSuggestions(p.suggestions, env, b, rep) : { suggestions: [], norms: {} };
  if (list.some((t) => !targets.has(t.id)) || !links) return null;
  positionRules({ pack: p, env, rep }, targets);

  const traditions = list.map((t): Tradition => {
    const sheet = targets.get(t.id)!;
    return {
      id: t.id,
      name: t.name,
      adherents: t.adherents,
      summary: t.summary,
      positions: sheet.positions,
      principles: sheet.principles,
      divided: sheet.divided,
      answers: sheet.answers,
      neighbours: t.neighbours.map((n) => ({ id: n.id, split: n.split })),
      inside: t.inside,
      outside: t.outside,
    };
  });
  const readings = Object.fromEntries(p.readings.file.map((r) => [r.id, reading(r, env)]));
  const body = {
    format: 'whoami.analysis' as const,
    schema: 1 as const,
    compare: p.traditions.file.compare,
    traditions,
    readings,
    suggestions: links.suggestions,
    norms: links.norms,
  };
  const version = createHash('sha256').update(canonicalJson(body)).digest('hex').slice(0, 12);
  return { ...body, version };
}

function reading(r: ReadingsFile[number], env: Env): Reading {
  const out: Reading = { id: r.id, author: r.author, title: r.title, year: r.year, kind: r.kind, voice: r.voice, note: r.note };
  if (r.in) out.in = r.in;
  const pole = r.about ? env.axes.get(r.about.axis)?.poles.indexOf(r.about.toward) : -1;
  if (r.about && (pole === 0 || pole === 1)) out.about = { axis: r.about.axis, pole };
  return out;
}

/** E003 for repeats, E004 for anything that names a spectrum, principle, tradition or reading that doesn't exist. */
function checkReferences({ traditions: T, readings: R, sheets, suggestions: G }: ParsedPack, env: Env, rep: Reporter): void {
  const list = T.file.traditions;
  checkUnique(list, 'tradition', T.pf, ['traditions'], rep);
  checkUnique(R.file, 'reading', R.pf, [], rep);
  if (G) checkUnique(G.file.suggestions, 'suggestion', G.pf, ['suggestions'], rep);
  const traditionIds = new Set(list.map((t) => t.id));
  const readingIds = new Set(R.file.map((r) => r.id));

  T.file.compare.forEach((id, i) => {
    const loc: Loc = { pf: T.pf, path: ['compare', i] };
    if (!env.principles.has(id)) rep.report('E004', `Unknown principle '${id}'`, loc);
    if (T.file.compare.indexOf(id) !== i) rep.report('E003', `'${id}' is listed twice in compare`, loc);
  });

  // One answer sheet per tradition.
  const sheeted = new Set<string>();
  for (const { pf, file } of sheets) {
    const loc: Loc = { pf, path: ['tradition'] };
    if (!traditionIds.has(file.tradition)) rep.report('E004', `Unknown tradition '${file.tradition}'`, loc);
    else if (sheeted.has(file.tradition)) rep.report('E003', `'${file.tradition}' has two answer sheets`, loc);
    sheeted.add(file.tradition);
  }

  list.forEach((t, i) => {
    const at = (...path: (string | number)[]): Loc => ({ pf: T.pf, path: ['traditions', i, ...path] });
    if (!sheeted.has(t.id)) rep.report('E015', `'${t.id}' has no answer sheet: add content/analysis/sheets/${t.id}.yaml`, at('id'));
    const neighbours = new Set<string>();
    t.neighbours.forEach((n, k) => {
      if (!traditionIds.has(n.id)) rep.report('E004', `Unknown tradition '${n.id}'`, at('neighbours', k, 'id'));
      else if (neighbours.has(n.id)) rep.report('E003', `'${n.id}' is listed twice as a neighbour of '${t.id}'`, at('neighbours', k, 'id'));
      neighbours.add(n.id);
    });
    const readings = new Set<string>();
    for (const side of ['inside', 'outside'] as const) {
      t[side].forEach((id, k) => {
        if (!readingIds.has(id)) rep.report('E004', `Unknown reading '${id}'`, at(side, k));
        else if (readings.has(id)) rep.report('E003', `Reading '${id}' is listed twice for '${t.id}'`, at(side, k));
        readings.add(id);
      });
    }
  });

  R.file.forEach((r, j) => {
    const at = (...path: (string | number)[]): Loc => ({ pf: R.pf, path: [j, ...path] });
    if (!traditionIds.has(r.voice)) rep.report('E004', `Unknown tradition '${r.voice}'`, at('voice'));
    if (!r.about) return;
    const axis = env.axes.get(r.about.axis);
    if (!axis) rep.report('E004', `Unknown spectrum '${r.about.axis}'`, at('about', 'axis'));
    else if (!axis.poles.includes(r.about.toward)) {
      rep.report('E004', `'${r.about.toward}' isn't a pole of '${axis.id}' (${axis.poles.join(' or ')})`, at('about', 'toward'));
    }
  });
}
