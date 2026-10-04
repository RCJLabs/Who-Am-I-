// Analysis-pack rules. E014 keeps the political traditions balanced between the sides, on every
// political spectrum, with each tradition's first critique coming from the other side.
// W111 keeps the readings balanced. W108 and W112 keep loaded terms and party or politician names
// out of what users read; titles, authors and `in` are citations, quoted as published, so exempt.
// The pack has its own loaded terms on top of the content's: words such as "moderate" or
// "mainstream" are fine in a question but cast a tradition as the default.
import type { Side } from '../../model/analysis.ts';
import type { ParsedPack } from '../analysis.ts';
import type { Env, Loc, Reporter } from '../context.ts';
import { findTerms, termMatchers } from '../loaded-terms.ts';
import { politicalAxes, type SheetTargets } from '../sheets.ts';

export interface PackCtx {
  pack: ParsedPack;
  env: Env;
  rep: Reporter;
}

/** A tradition counts as placed toward a pole from this far out. */
const PLACED = 0.3;
/** Traditions needed toward each pole of every political spectrum. */
const PER_POLE = 2;
const OPPOSITE: Record<Side, Side> = { left: 'right', right: 'left', center: 'center' };

export function packRules(ctx: PackCtx): void {
  traditionRules(ctx);
  readingRules(ctx);
  wordingRules(ctx);
}

/** With the positions the answer sheets give: enough traditions toward each pole of every spectrum. */
export function positionRules({ pack, env, rep }: PackCtx, targets: ReadonlyMap<string, SheetTargets>): void {
  for (const id of politicalAxes(env)) {
    const a = env.axes.get(id)!;
    const placed = [...targets.values()].filter((t) => !t.divided.includes(id)).map((t) => t.positions[id] ?? 0);
    for (const [k, n] of [placed.filter((v) => v <= -PLACED).length, placed.filter((v) => v >= PLACED).length].entries()) {
      if (n < PER_POLE) {
        rep.report('E014', `Only ${n} tradition${n === 1 ? '' : 's'} sit${n === 1 ? 's' : ''} toward ${a.poles[k]} on '${id}' (${k ? '' : '−'}${PLACED} or beyond, not divided); at least ${PER_POLE} are needed`, {
          pf: pack.traditions.pf,
          path: ['traditions'],
        });
      }
    }
  }
}

function traditionRules({ pack, rep }: PackCtx): void {
  const { pf, file } = pack.traditions;
  const side = new Map(file.traditions.map((t) => [t.id, t.side]));
  const voice = new Map(pack.readings.file.map((r) => [r.id, r.voice]));
  const voiceSide = (reading: string | undefined): Side | undefined => side.get(voice.get(reading ?? '') ?? '');

  file.traditions.forEach((t, i) => {
    const at = (...path: (string | number)[]): Loc => ({ pf, path: ['traditions', i, ...path] });
    t.neighbours.forEach((n, k) => {
      const other = file.traditions.find((x) => x.id === n.id);
      if (n.id === t.id) rep.report('E014', `'${t.id}' lists itself as a neighbour`, at('neighbours', k, 'id'));
      else if (other && !other.neighbours.some((m) => m.id === t.id)) {
        rep.report('E014', `'${t.id}' lists '${n.id}' as a neighbour, but '${n.id}' doesn't list '${t.id}'`, at('neighbours', k, 'id'));
      }
    });

    // Unknown readings and voices are E004 already.
    t.inside.forEach((id, k) => {
      const v = voice.get(id);
      if (v && side.has(v) && v !== t.id) rep.report('E014', `Inside reading '${id}' is voiced by '${v}', not '${t.id}'`, at('inside', k));
    });
    t.outside.forEach((id, k) => {
      if (voice.get(id) === t.id) rep.report('E014', `Outside reading '${id}' is voiced by '${t.id}' itself`, at('outside', k));
    });

    // The first critique comes from the other side; a center tradition's first two, one from each.
    if (t.side === 'center') {
      const [a, b] = t.outside.slice(0, 2).map(voiceSide);
      const known = t.outside.length >= 2 && a && b;
      const ok = known && ((a === 'left' && b === 'right') || (a === 'right' && b === 'left'));
      if (t.outside.length < 2 || (known && !ok)) {
        rep.report('E014', `'${t.id}' is a center tradition: its first two critiques come one from the left and one from the right`, at('outside'));
      }
    } else {
      const s = voiceSide(t.outside[0]);
      if (s && s !== OPPOSITE[t.side]) {
        rep.report('E014', `'${t.id}' is on the ${t.side}, so its first critique comes from the ${OPPOSITE[t.side]}, not the ${s}`, at('outside', 0));
      }
    }
  });

  const left = file.traditions.filter((t) => t.side === 'left').length;
  const right = file.traditions.filter((t) => t.side === 'right').length;
  if (Math.abs(left - right) > 1) rep.report('E014', `${left} traditions are on the left and ${right} on the right: keep them within one of each other`, { pf, path: ['traditions'] });
}

function readingRules({ pack, env, rep }: PackCtx): void {
  const T = pack.traditions;
  const R = pack.readings;
  const side = new Map(T.file.traditions.map((t) => [t.id, t.side]));
  const voice = new Map(R.file.map((r) => [r.id, r.voice]));

  T.file.traditions.forEach((t, i) => {
    for (const list of ['inside', 'outside'] as const) {
      const n = t[list].length;
      if (n < 2) rep.report('W111', `'${t.id}' has ${n} ${list} reading${n === 1 ? '' : 's'}; give it at least 2`, { pf: T.pf, path: ['traditions', i, list] });
    }
  });

  const listed = new Set(T.file.traditions.flatMap((t) => [...t.inside, ...t.outside]));
  R.file.forEach((r, j) => {
    if (!listed.has(r.id)) rep.report('W111', `Reading '${r.id}' isn't listed by any tradition`, { pf: R.pf, path: [j, 'id'] });
  });

  const tally = (ids: readonly string[]) => {
    const n = { left: 0, right: 0 };
    for (const id of ids) {
      const s = side.get(voice.get(id) ?? '');
      if (s === 'left' || s === 'right') n[s]++;
    }
    return n;
  };
  const uneven = (n: { left: number; right: number }) => Math.abs(n.left - n.right) > Math.max(2, 0.2 * (n.left + n.right));
  const voices = tally(R.file.map((r) => r.id));
  if (uneven(voices)) {
    rep.report('W111', `${voices.left} readings are voiced from the left and ${voices.right} from the right: keep them roughly even`, { pf: R.pf, path: [] });
  }
  const critiques = tally(T.file.traditions.flatMap((t) => t.outside));
  if (uneven(critiques)) {
    rep.report('W111', `Critiques come from the left ${critiques.left} times and from the right ${critiques.right} times: keep them roughly even`, { pf: T.pf, path: ['traditions'] });
  }

  for (const a of env.axes.values()) {
    const toward = [0, 0];
    for (const r of R.file) {
      const k = r.about?.axis === a.id ? a.poles.indexOf(r.about.toward) : -1;
      if (k === 0 || k === 1) toward[k]!++;
    }
    if (Math.abs(toward[0]! - toward[1]!) > 1) {
      rep.report('W111', `On '${a.id}', ${toward[0]} reading(s) argue for ${a.poles[0]} and ${toward[1]} for ${a.poles[1]}: keep them within one`, { pf: R.pf, path: [] });
    }
  }
}

function wordingRules({ pack, env, rep }: PackCtx): void {
  const loaded = termMatchers([...env.loadedTerms, ...env.packTerms]);
  const named = termMatchers(env.namedPolitics);
  const flag = (text: string, loc: Loc) => {
    for (const term of findTerms(text, loaded)) rep.report('W108', `Loaded term "${term}": use neutral wording`, loc);
    for (const name of findTerms(text, named)) rep.report('W112', `"${name}" names a party or politician: describe the idea instead`, loc);
  };
  const T = pack.traditions;
  T.file.traditions.forEach((t, i) => {
    const at = (...path: (string | number)[]): Loc => ({ pf: T.pf, path: ['traditions', i, ...path] });
    flag(t.name, at('name'));
    flag(t.adherents, at('adherents'));
    flag(t.summary, at('summary'));
    t.neighbours.forEach((n, k) => flag(n.split, at('neighbours', k, 'split')));
  });
  pack.readings.file.forEach((r, j) => flag(r.note, { pf: pack.readings.pf, path: [j, 'note'] }));
}
