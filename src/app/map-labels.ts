// Direct labels for the traditions on the political map. Each label tries the right of its marker,
// then the left, above and below, and takes the first spot inside the frame that covers nothing
// already there: the user's dot, the pole labels, other markers, labels placed before it. If every
// spot covers something, it takes the one that covers least. Pure, so it's tested without a browser.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelInput {
  id: string;
  name: string;
  /** Marker centre, in SVG units. */
  cx: number;
  cy: number;
}

export interface Placed {
  id: string;
  lines: string[];
  /** Text anchor point of the first line's baseline. */
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
  box: Box;
}

/** Approximate advance of 11px semibold text, and the line height: there's no DOM to measure. */
export const CHAR_W = 6.3;
export const LINE_H = 13;
/** Gap between a marker and its label. */
const GAP = 7;
/** Names longer than this wrap onto two lines. */
const WRAP = 14;

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
export function textBox(text: string, x: number, y: number, anchor: Placed['anchor'], charW = CHAR_W, lineH = LINE_H): Box {
  const w = text.length * charW;
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return { x: left, y: y - lineH + 3, w, h: lineH };
}

export function placeLabels(labels: readonly LabelInput[], frame: Box, avoid: readonly Box[]): Placed[] {
  const taken = [...avoid];
  return labels.map((l) => {
    const lines = labelLines(l.name);
    const w = Math.max(...lines.map((s) => s.length)) * CHAR_W;
    const h = lines.length * LINE_H;
    const spot = (left: number, top: number, anchor: Placed['anchor']): Omit<Placed, 'id' | 'lines'> => ({
      box: { x: left, y: top, w, h },
      x: anchor === 'start' ? left : anchor === 'end' ? left + w : left + w / 2,
      y: top + LINE_H - 3,
      anchor,
    });
    const candidates = [
      spot(l.cx + GAP, l.cy - h / 2, 'start'),
      spot(l.cx - GAP - w, l.cy - h / 2, 'end'),
      spot(l.cx - w / 2, l.cy - GAP - h, 'middle'),
      spot(l.cx - w / 2, l.cy + GAP, 'middle'),
    ];
    const cost = (c: (typeof candidates)[number]) => (inside(c.box, frame) ? 0 : 1e6) + taken.reduce((n, t) => n + overlap(c.box, t), 0);
    let best = candidates[0]!;
    for (const c of candidates.slice(1)) if (cost(c) < cost(best)) best = c;
    taken.push(best.box);
    return { id: l.id, lines, ...best };
  });
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
