// Which political traditions the answers sit closest to. Reference points, never labels: a
// tradition is named only when the answers are consistent enough and one (or two) clearly fit.
// Always given the shareable profile, so worldview and sensitive answers can't move it.
// The rules and their reasons are in docs/ANALYSIS.md, "Political traditions".
import type { AnalysisPack, Tradition } from '../../model/analysis.ts';
import type { Axis, Bundle, PrincipleId } from '../../model/content.ts';
import type { Profile, Scored } from '../../model/profile.ts';
import { LIMIT, LOW_CONFIDENCE, TRADITION } from './constants.ts';
import type { Closeness, TraditionDifference, TraditionFacts, TraditionFit } from './types.ts';

type Scores = Pick<Profile, 'axes' | 'principles'>;

interface Dim {
  id: string;
  u: number;
  c: number;
}

export function matchTraditions(b: Bundle, profile: Scores, pack: AnalysisPack): TraditionFacts {
  // The political spectrums every tradition is placed on (planned ones aren't), in content order.
  const political = Object.values(b.axes).filter((a) => a.family === 'political' && pack.traditions.every((t) => a.id in t.positions));
  const scored = dims(political.map((a) => a.id), profile.axes);
  const compared = scored.map((d) => d.id);
  const missing = political.map((a) => a.id).filter((id) => !compared.includes(id));
  const total = sum(scored.map((d) => d.c));
  if (scored.length < TRADITION.minAxes || total < TRADITION.minConfidence) {
    return { status: 'insufficient', named: [], fits: [], compared, missing, principles: [], spread: [], coherence: null };
  }

  const coherence = round(sum(scored.map((d) => d.c * profile.axes[d.id]!.spread)) / total);
  const principleDims = dims(pack.compare, profile.principles);
  const usePrinciples = sum(principleDims.map((d) => d.c)) >= TRADITION.principleEvidence;
  const ranked = pack.traditions
    .map((t, order) => ({ t, order, distance: distance(t, scored, usePrinciples ? principleDims : null) }))
    .sort((x, y) => x.distance - y.distance || x.order - y.order);

  const gated = (t: Tradition): boolean => rms(political.map((a) => t.positions[a.id] ?? 0)) < TRADITION.centerNorm && coherence > TRADITION.centerCoherence;
  const [first, second] = ranked;
  let status: TraditionFacts['status'];
  let reason: TraditionFacts['reason'];
  if (coherence > TRADITION.mixed) [status, reason] = ['mixed', 'spread'];
  else if (first!.distance >= TRADITION.loose) status = 'loose';
  else if (gated(first!.t)) [status, reason] = ['mixed', 'center'];
  else if (second && second.distance - first!.distance < TRADITION.between && second.distance < TRADITION.loose && !gated(second.t)) status = 'between';
  else status = 'match';

  const listed = ranked.slice(0, status === 'mixed' ? 2 : LIMIT.traditions);
  const fits = listed.map(
    ({ t, distance: d }): TraditionFit => ({
      tradition: t.id,
      distance: d,
      closeness: closeness(d),
      differences: differences(t, scored, usePrinciples ? principleDims : [], political),
    }),
  );
  const named = status === 'match' ? [first!.t.id] : status === 'between' ? [first!.t.id, second!.t.id] : [];
  const spread = [...scored]
    .sort((x, y) => profile.axes[y.id]!.spread - profile.axes[x.id]!.spread || compared.indexOf(x.id) - compared.indexOf(y.id))
    .slice(0, 2)
    .map((d) => d.id);
  return {
    status,
    named,
    fits,
    ...(reason ? { reason } : {}),
    compared,
    missing,
    principles: usePrinciples ? principleDims.map((d) => d.id) : [],
    spread,
    coherence,
  };
}

/** The scored entries among these ids, in order. */
function dims(ids: readonly string[], scores: Record<string, Scored>): Dim[] {
  return ids.flatMap((id) => {
    const s = scores[id];
    return s && s.score !== null && s.confidence > 0 ? [{ id, u: s.score, c: s.confidence }] : [];
  });
}

/**
 * Confidence-weighted RMS distance over the scored spectrums, with what the tradition is divided
 * on counting half; compared principles take a quarter of the squared distance when they count.
 */
function distance(t: Tradition, axes: readonly Dim[], principles: readonly Dim[] | null): number {
  const part = (list: readonly Dim[], target: Record<string, number>): number => {
    let num = 0;
    let den = 0;
    for (const d of list) {
      const w = d.c * (t.divided.includes(d.id) ? TRADITION.dividedWeight : 1);
      num += w * (d.u - (target[d.id] ?? 0)) ** 2;
      den += w;
    }
    return den ? num / den : 0;
  };
  const a = part(axes, t.positions);
  const d2 = principles ? (1 - TRADITION.principleShare) * a + TRADITION.principleShare * part(principles, t.principles) : a;
  return round(Math.sqrt(d2));
}

function closeness(d: number): Closeness {
  if (d < TRADITION.band.veryClose) return 'very-close';
  if (d < TRADITION.band.close) return 'close';
  return d < TRADITION.loose ? 'some' : 'little';
}

/**
 * The biggest gaps between the answers and a tradition, on results with enough evidence and never
 * where its adherents split. Spectrums come before principles when gaps tie, then content order.
 */
function differences(t: Tradition, axes: readonly Dim[], principles: readonly Dim[], political: readonly Axis[]): TraditionDifference[] {
  const out: (TraditionDifference & { order: number })[] = [];
  const firm = (d: Dim) => d.c >= LOW_CONFIDENCE && !t.divided.includes(d.id);
  for (const d of axes) {
    const gap = round(Math.abs(d.u - (t.positions[d.id] ?? 0)));
    if (firm(d) && gap >= TRADITION.difference) {
      out.push({ kind: 'axis', axis: d.id, toward: d.u > (t.positions[d.id] ?? 0) ? 1 : 0, gap, order: political.findIndex((a) => a.id === d.id) });
    }
  }
  principles.forEach((d, i) => {
    const gap = round(Math.abs(d.u - (t.principles[d.id as PrincipleId] ?? 0)));
    if (firm(d) && gap >= TRADITION.difference) out.push({ kind: 'principle', principle: d.id, more: d.u > (t.principles[d.id] ?? 0), gap, order: 100 + i });
  });
  return out
    .sort((x, y) => y.gap - x.gap || x.order - y.order)
    .slice(0, LIMIT.differences)
    .map(({ order: _order, ...rest }) => rest);
}

function rms(values: readonly number[]): number {
  return values.length ? Math.sqrt(sum(values.map((v) => v * v)) / values.length) : 0;
}

function sum(values: readonly number[]): number {
  return values.reduce((a, v) => a + v, 0);
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
