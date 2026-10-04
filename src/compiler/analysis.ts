// The analysis pack (content/analysis/): political traditions and the readings the results
// analysis offers. Compiled with the content, so it's checked against the same spectrums,
// principles and word lists, but hashed on its own: editing it never changes contentVersion.
import { createHash } from 'node:crypto';
import {
  ReadingsFileSchema,
  TraditionsFileSchema,
  type AnalysisPack,
  type Reading,
  type ReadingsFile,
  type Tradition,
  type TraditionsFile,
} from '../model/analysis.ts';
import type { Env, Loc, Reporter } from './context.ts';
import { packRules } from './rules/analysis.ts';
import type { AnalysisSources } from './types.ts';
import { canonicalJson, checkUnique, validate } from './validate.ts';
import { parseYaml, type ParsedFile } from './yaml.ts';

export interface ParsedPack {
  traditions: { pf: ParsedFile; file: TraditionsFile };
  readings: { pf: ParsedFile; file: ReadingsFile };
}

/** Parses and validates the pack's files. Null when there is no pack, or it doesn't validate. */
export function parsePack(src: AnalysisSources | undefined, rep: Reporter): ParsedPack | null {
  if (!src || (!src.traditions && !src.readings)) return null;
  const tpf = src.traditions ? parseYaml(src.traditions, rep.diagnostics) : null;
  const rpf = src.readings ? parseYaml(src.readings, rep.diagnostics) : null;
  const traditions = tpf && validate(tpf, TraditionsFileSchema, rep);
  const readings = rpf && validate(rpf, ReadingsFileSchema, rep);
  if (!src.traditions || !src.readings) {
    const pf = tpf ?? rpf;
    if (pf) rep.report('E002', 'The analysis pack needs both traditions.yaml and readings.yaml', { pf, path: [] });
    return null;
  }
  if (!tpf || !rpf || !traditions || !readings) return null;
  return { traditions: { pf: tpf, file: traditions }, readings: { pf: rpf, file: readings } };
}

/** Checks references, duplicates and the pack rules, then builds the pack the app loads. */
export function compilePack(p: ParsedPack, env: Env, rep: Reporter): AnalysisPack {
  checkReferences(p, env, rep);
  packRules({ pack: p, env, rep });

  const traditions = p.traditions.file.traditions.map(
    (t): Tradition => ({
      id: t.id,
      name: t.name,
      adherents: t.adherents,
      summary: t.summary,
      positions: t.positions,
      principles: t.principles,
      divided: t.divided ?? [],
      neighbours: t.neighbours.map((n) => ({ id: n.id, split: n.split })),
      inside: t.inside,
      outside: t.outside,
    }),
  );
  const readings = Object.fromEntries(p.readings.file.map((r) => [r.id, reading(r, env)]));
  const body = { format: 'whoami.analysis' as const, schema: 1 as const, compare: p.traditions.file.compare, traditions, readings };
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
function checkReferences({ traditions: T, readings: R }: ParsedPack, env: Env, rep: Reporter): void {
  const list = T.file.traditions;
  checkUnique(list, 'tradition', T.pf, ['traditions'], rep);
  checkUnique(R.file, 'reading', R.pf, [], rep);
  const traditionIds = new Set(list.map((t) => t.id));
  const readingIds = new Set(R.file.map((r) => r.id));

  T.file.compare.forEach((id, i) => {
    const loc: Loc = { pf: T.pf, path: ['compare', i] };
    if (!env.principles.has(id)) rep.report('E004', `Unknown principle '${id}'`, loc);
    if (T.file.compare.indexOf(id) !== i) rep.report('E003', `'${id}' is listed twice in compare`, loc);
  });

  list.forEach((t, i) => {
    const at = (...path: (string | number)[]): Loc => ({ pf: T.pf, path: ['traditions', i, ...path] });
    for (const id of Object.keys(t.positions)) if (!env.axes.has(id)) rep.report('E004', `Unknown spectrum '${id}'`, at('positions', id));
    for (const id of Object.keys(t.principles)) if (!env.principles.has(id)) rep.report('E004', `Unknown principle '${id}'`, at('principles', id));
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
