// Where the words go on the political map: the pole labels, and direct labels for the traditions.
// A tradition's label tries spots next to its marker on every side, then spots further out joined
// to the marker by a short leader line, and takes the spot that covers least of what's already
// there: the user's dot, the pole labels, the other markers, the labels placed before it. Covering
// a mark or a label hides it, so that costs far more than crossing the dot's faint halo. Labels are
// placed nearest tradition first; the ones the summary names are always placed, and any other is
// left off rather than hide something. Pole labels sit by their axis on the side away from the dot,
// unless the other side covers less. Pure, so it's tested without a browser: the map passes in
// text widths measured from the font on screen.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Something to keep clear of: covering it costs `weight` per unit of area (1 if unset). */
export interface Obstacle extends Box {
  weight?: number;
}

/** Width of a line of text at a font size, in SVG units. */
export type Measure = (text: string, size: number) => number;

export interface LabelInput {
  id: string;
  name: string;
  /** Marker centre, in SVG units. */
  cx: number;
  cy: number;
  /** Left off if every spot would cover something; otherwise placed where it covers least. */
  optional?: boolean;
}

export interface Placed {
  id: string;
  lines: string[];
  /** Text anchor point of the first line's baseline. */
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
  box: Box;
  /** From the marker to the label, when the label sits away from it. */
  leader: { x1: number; y1: number; x2: number; y2: number } | null;
}

/** Font sizes of the tradition and pole labels, as in the map's styles, and the line height. */
export const LABEL_SIZE = 11;
export const POLE_SIZE = 12;
export const LINE_H = 13;
/** Approximate advance of semibold text at 11px, for when there's no font to measure. */
export const CHAR_W = 6.3;
export const estimate: Measure = (text, size) => text.length * CHAR_W * (size / LABEL_SIZE);

/** Covering a mark or a label hides it. */
export const HIDE = 10;
/** Gap between a marker and its label; further rings need a leader line, and cost a little. */
const GAP = 7;
const RINGS = [0, 14, 28];
const RING_COST = 60;
/** Names longer than this wrap onto two lines; one line is the fallback, at a small cost. */
const WRAP = 14;
const ONE_LINE_COST = 10;
/** An optional label that would cost this much is left off. */
const DROP = 200;
/** Leaders start clear of their own marker's box. */
const LEADER_START = 7.5;

/** The map's frame in SVG units, and where a score from −1 to 1 lands on it. */
export const LO = 12;
export const SIZE = 276;
export const FRAME: Box = { x: LO, y: LO, w: SIZE, h: SIZE };
export const px = (v: number): number => LO + ((v + 1) / 2) * SIZE;
export const py = (v: number): number => LO + (1 - (v + 1) / 2) * SIZE;

/** A name as one line, or two broken at the space nearest the middle. */
export function labelLines(name: string): string[] {
  if (name.length <= WRAP) return [name];
  const spaces = [...name.matchAll(/ /g)].map((m) => m.index);
  if (!spaces.length) return [name];
  const mid = name.length / 2;
  const at = spaces.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best));
  return [name.slice(0, at), name.slice(at + 1)];
}

/** Approximate box of a line of text at (x, baseline y) with this anchor. */
export function textBox(text: string, x: number, y: number, anchor: Placed['anchor'], measure: Measure = estimate, size = LABEL_SIZE): Box {
  const w = measure(text, size);
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return { x: left, y: y - size + 1, w, h: size + 2 };
}

export function placeLabels(labels: readonly LabelInput[], frame: Box, avoid: readonly Obstacle[], measure: Measure = estimate): Placed[] {
  const taken: Obstacle[] = [...avoid];
  const placed: Placed[] = [];
  for (const l of labels) {
    const forms = labelLines(l.name).length > 1 ? [labelLines(l.name), [l.name]] : [[l.name]];
    let best: { placed: Placed; cost: number } | undefined;
    for (const [f, lines] of forms.entries()) {
      const w = Math.max(...lines.map((s) => measure(s, LABEL_SIZE)));
      const h = lines.length * LINE_H;
      for (const [k, ring] of RINGS.entries()) {
        const d = GAP + ring;
        const e = d * Math.SQRT1_2;
        // Right, left, above, below, then the four corners.
        const spots: [number, number, Placed['anchor']][] = [
          [l.cx + d, l.cy - h / 2, 'start'],
          [l.cx - d - w, l.cy - h / 2, 'end'],
          [l.cx - w / 2, l.cy - d - h, 'middle'],
          [l.cx - w / 2, l.cy + d, 'middle'],
          [l.cx + e, l.cy - e - h, 'start'],
          [l.cx - e - w, l.cy - e - h, 'end'],
          [l.cx + e, l.cy + e, 'start'],
          [l.cx - e - w, l.cy + e, 'end'],
        ];
        for (const [left, top, anchor] of spots) {
          const box = { x: left, y: top, w, h };
          if (!inside(box, frame)) continue;
          const leader = k ? leaderTo(l, box) : null;
          const cost = covered(box, taken) + (leader ? crossed(leader, taken) : 0) + k * RING_COST + f * ONE_LINE_COST;
          if (best && cost >= best.cost) continue;
          const x = anchor === 'start' ? left : anchor === 'end' ? left + w : left + w / 2;
          best = { cost, placed: { id: l.id, lines, x, y: top + LINE_H - 3, anchor, box, leader } };
        }
      }
    }
    if (!best || (l.optional && best.cost >= DROP)) continue;
    taken.push({ ...best.placed.box, weight: HIDE });
    placed.push(best.placed);
  }
  return placed;
}

export interface PoleLabel {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'end';
}

export interface MapRefInput {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Its place in the analysis list, nearest first; null when it isn't listed, and so unlabelled. */
  rank: number | null;
  /** Named in the summary, so always labelled. */
  named: boolean;
}

/** Where every word on the map goes, for the user at (x, y) and the traditions in `refs`. */
export function layoutMap(
  you: { x: number; y: number },
  poles: { x: readonly [string, string]; y: readonly [string, string] },
  refs: readonly MapRefInput[],
  measure: Measure = estimate,
): { poles: PoleLabel[]; labels: Placed[] } {
  const dx = px(you.x);
  const dy = py(you.y);
  const marks: Obstacle[] = [
    { x: dx - 10, y: dy - 10, w: 20, h: 20, weight: HIDE },
    { x: dx - 18, y: dy - 18, w: 36, h: 36 },
    ...refs.map((r) => ({ x: px(r.x) - 5, y: py(r.y) - 5, w: 10, h: 10, weight: HIDE })),
  ];
  const box = (p: PoleLabel) => textBox(p.text, p.x, p.y, p.anchor, measure, POLE_SIZE);
  // Each axis's two pole labels share a side of it: away from the dot, unless the other side covers less.
  const side = (preferred: PoleLabel[], other: PoleLabel[]) => {
    const cost = (pair: PoleLabel[]) => pair.reduce((n, p) => n + covered(box(p), marks), 0);
    return cost(other) < cost(preferred) ? other : preferred;
  };
  const vertical = (x: number, anchor: PoleLabel['anchor']): PoleLabel[] => [
    { text: poles.y[1], x, y: LO + 20, anchor },
    { text: poles.y[0], x, y: LO + SIZE - 10, anchor },
  ];
  const horizontal = (y: number): PoleLabel[] => [
    { text: poles.x[0], x: LO + 10, y, anchor: 'start' },
    { text: poles.x[1], x: LO + SIZE - 10, y, anchor: 'end' },
  ];
  const leftOfAxis = vertical(px(0) - 8, 'end');
  const rightOfAxis = vertical(px(0) + 8, 'start');
  const below = horizontal(py(0) + 18);
  const above = horizontal(py(0) - 8);
  const placedPoles = [...(you.x >= 0 ? side(leftOfAxis, rightOfAxis) : side(rightOfAxis, leftOfAxis)), ...(you.y >= 0 ? side(below, above) : side(above, below))];

  const listed = refs.filter((r) => r.rank !== null).sort((a, b) => a.rank! - b.rank!);
  const labels = placeLabels(
    listed.map((r) => ({ id: r.id, name: r.name, cx: px(r.x), cy: py(r.y), optional: !r.named })),
    FRAME,
    [...marks, ...placedPoles.map((p) => ({ ...box(p), weight: HIDE }))],
    measure,
  );
  return { poles: placedPoles, labels };
}

function inside(b: Box, frame: Box): boolean {
  return b.x >= frame.x && b.y >= frame.y && b.x + b.w <= frame.x + frame.w && b.y + b.h <= frame.y + frame.h;
}

/** Area two boxes share. */
export function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** What a box costs for the obstacles it covers. */
function covered(b: Box, obstacles: readonly Obstacle[]): number {
  return obstacles.reduce((n, o) => n + (o.weight ?? 1) * overlap(b, o), 0);
}

type Segment = NonNullable<Placed['leader']>;

/** A leader from just outside the marker to just short of the nearest point of the label. */
function leaderTo(l: LabelInput, b: Box): Segment {
  const tx = Math.min(Math.max(l.cx, b.x), b.x + b.w);
  const ty = Math.min(Math.max(l.cy, b.y), b.y + b.h);
  const len = Math.hypot(tx - l.cx, ty - l.cy);
  const ux = (tx - l.cx) / len;
  const uy = (ty - l.cy) / len;
  return { x1: l.cx + ux * LEADER_START, y1: l.cy + uy * LEADER_START, x2: tx - ux * 2, y2: ty - uy * 2 };
}

/** What a leader costs for the length of it that runs across obstacles. */
function crossed(s: Segment, obstacles: readonly Obstacle[]): number {
  return obstacles.reduce((n, o) => n + (o.weight ?? 1) * lengthInside(s, o), 0);
}

/** Length of a segment inside a box (Liang–Barsky clipping). */
export function lengthInside(s: Segment, b: Box): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [
    [-dx, s.x1 - b.x],
    [dx, b.x + b.w - s.x1],
    [-dy, s.y1 - b.y],
    [dy, b.y + b.h - s.y1],
  ] as const) {
    if (p === 0) {
      if (q < 0) return 0;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return 0;
  }
  return (t1 - t0) * Math.hypot(dx, dy);
}
