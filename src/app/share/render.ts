// Draws a share card on a canvas: 1080×1350 pixels (4:5, a shape most apps show whole), in the
// app's own light or dark colours and fonts, with the same marks as the results pages. All of it
// happens on this device; the image only leaves it if the person shares or saves it.
import { copy } from '../copy.ts';
import { ICONS, type IconName } from '../icons.ts';
import { PATTERN_AREAS, toPercent, type PatternSpoke } from '../view.ts';
import type { CardStrip, CardTradition, PatternCard, PrinciplesCard, ShareCard, SpectrumCard } from './cards.ts';
import { ellipsize, mix, PALETTES, wrapParts, type CardTheme, type Palette } from './layout.ts';

export const WIDTH = 1080;
export const HEIGHT = 1350;
/** The margin around everything. */
const PAD = 72;
const INNER = WIDTH - 2 * PAD;
/** The height of an area card's tinted header. */
const HEAD = 300;
/** The footer's baseline, and the note above it on hollow marks. */
const FOOT = HEIGHT - PAD + 4;
const NOTE = FOOT - 48;

const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
const BODY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const font = (weight: number, size: number, family = BODY) => `${weight} ${size}px ${family}`;
const C = copy.share.card;

type Ctx = CanvasRenderingContext2D;

let fonts: Promise<unknown> | null = null;
/** The display font loads on first use: wait for it (or draw in the fallback if it can't load). */
function fontsReady(): Promise<unknown> {
  fonts ??= document.fonts.load(font(800, 40, DISPLAY)).catch(() => undefined);
  return fonts;
}

/** The card as a PNG image. */
export async function cardImage(card: ShareCard, theme: CardTheme): Promise<Blob> {
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas to draw on');
  drawCard(ctx, card, PALETTES[theme]);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The image was not made'))), 'image/png'));
}

function drawCard(ctx: Ctx, card: ShareCard, p: Palette): void {
  ctx.fillStyle = p.surface;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textBaseline = 'alphabetic';
  if (card.kind === 'pattern') drawPattern(ctx, card, p);
  else if (card.kind === 'spectrums') drawSpectrums(ctx, card, p);
  else drawPrinciples(ctx, card, p);
  if (card.note) put(ctx, card.note, PAD, NOTE, font(500, 28), p.muted);
  put(ctx, card.footer, PAD, FOOT, font(500, 30), p.muted);
}

/** Where a card's body has to end, above the footer and the note on hollow marks. */
const bodyEnd = (card: ShareCard) => (card.note ? NOTE : FOOT) - 56;

// --- The pattern -------------------------------------------------------------------------------

function drawPattern(ctx: Ctx, c: PatternCard, p: Palette): void {
  // The name, with a dot for each area's colour.
  put(ctx, copy.appName, PAD, 112, font(800, 40, DISPLAY), p.text);
  PATTERN_AREAS.forEach(({ area }, k) => circle(ctx, WIDTH - PAD - 13 - (PATTERN_AREAS.length - 1 - k) * 36, 98, 13, p.area[area]));
  put(ctx, c.name, PAD, 232, font(800, 92, DISPLAY), p.text);

  // The ring's drawing reaches 41.5% of its width out from the centre.
  const d = 600;
  const reach = 0.415 * d;
  const cy = 290 + reach;
  drawRing(ctx, c, p, WIDTH / 2, cy, d);

  // Which colour is which area.
  const items = c.groups.map((g) => ({ color: p.area[g.area], label: C.areas[g.area] }));
  const lf = font(600, 30);
  const widths = items.map((i) => 22 + 12 + measure(ctx, lf, i.label));
  let x = (WIDTH - (widths.reduce((a, b) => a + b, 0) + 36 * (items.length - 1))) / 2;
  items.forEach((i, k) => {
    circle(ctx, x + 11, cy + reach + 56, 11, i.color);
    put(ctx, i.label, x + 34, cy + reach + 66, lf, p.text);
    x += widths[k]! + 36;
  });

  // The firmest leans, each with its area's colour and its spectrum.
  let y = cy + reach + 142;
  put(ctx, C.firmest, PAD, y, font(600, 30), p.muted);
  if (!c.firm.length) put(ctx, C.middle, PAD, y + 62, font(700, 44, DISPLAY), p.text);
  for (const f of c.firm) {
    y += 64;
    if (y > bodyEnd(c)) break;
    circle(ctx, PAD + 13, y - 15, 13, p.area[f.area]);
    const lf2 = font(700, 44, DISPLAY);
    const w = put(ctx, ellipsize(f.label, INNER - 42, (s) => measure(ctx, lf2, s)), PAD + 42, y, lf2, p.text);
    const tf = font(500, 30);
    const room = INNER - 42 - w - 18;
    if (measure(ctx, tf, f.title) <= room) put(ctx, f.title, PAD + 42 + w + 18, y, tf, p.muted);
  }
}

/** The overview's ring: one line per spectrum grouped by area, longer the further the answers lean. */
function drawRing(ctx: Ctx, c: PatternCard, p: Palette, cx: number, cy: number, d: number): void {
  /** Geometry in hundredths of the ring's width, as in PatternRing.svelte. */
  const u = d / 100;
  const GAP = 12;
  const step = (360 - GAP * c.groups.length) / Math.max(1, c.total);
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;

  ctx.lineWidth = 2;
  ctx.strokeStyle = p.border;
  for (const r of [37.8, 25, 12.2]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * u, 0, Math.PI * 2);
    ctx.stroke();
  }
  let at = GAP / 2;
  for (const g of c.groups) {
    const start = at;
    for (const s of g.spokes) {
      drawSpoke(ctx, s, at + step / 2, p.area[g.area], p, cx, cy, u);
      at += step;
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 40.25 * u, rad(start), rad(at));
    ctx.lineWidth = 2.5 * u;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = p.area[g.area];
    ctx.stroke();
    at += GAP;
  }
  put(ctx, String(c.total), cx, cy + 4, font(700, 60, DISPLAY), p.text, 'center');
  put(ctx, copy.analysis.overview.spectrums(c.total), cx, cy + 32, font(500, 21), p.muted, 'center');
}

function drawSpoke(ctx: Ctx, s: PatternSpoke, deg: number, color: string, p: Palette, cx: number, cy: number, u: number): void {
  const w = 3 * u;
  const from = 12.2 * u;
  const len = Math.max(0.08, s.strength) * 25.6 * u;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  rect(ctx, -w / 2, -(from + len), w, len, w / 2);
  if (s.low) {
    // Hollow: the line's outline only, drawn inside its edge.
    ctx.fillStyle = p.surface;
    ctx.fill();
    ctx.clip();
    ctx.lineWidth = 1.2 * u;
    ctx.strokeStyle = color;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

// --- An area's spectrums -------------------------------------------------------------------------

function drawSpectrums(ctx: Ctx, c: SpectrumCard, p: Palette): void {
  const color = p.area[c.area];
  drawHeader(ctx, c.name, c.area, mix(color, p.surface, 0.24), p);
  const lines = lineBreaks(ctx, c.line);
  const heights = c.strips.map((s) => stripHeight(ctx, s));
  const tradition = c.tradition ? TRADITION_H + 24 : 0;
  const room = bodyEnd(c) - (HEAD + lineHeight(lines)) - tradition - heights.reduce((a, b) => a + b, 0);
  const gap = Math.max(8, Math.min(40, room / Math.max(1, c.strips.length - 1)));
  // With only a spectrum or two, everything under the header sits in the middle of the space.
  let y = drawLine(ctx, lines, p, Math.max(0, (room - gap * (c.strips.length - 1)) / 2));
  c.strips.forEach((s, k) => {
    drawStrip(ctx, s, y, color, p);
    y += heights[k]! + gap;
  });
  if (c.tradition) drawTradition(ctx, c.tradition, y - gap + 24, p);
}

const TITLE = font(600, 30);
const LABEL = font(700, 32);
/** A spectrum whose title and position don't fit on one line takes two. */
const twoRows = (ctx: Ctx, s: CardStrip) => measure(ctx, TITLE, s.title) + 28 + measure(ctx, LABEL, s.label) > INNER;
const stripHeight = (ctx: Ctx, s: CardStrip) => (twoRows(ctx, s) ? 42 : 0) + 132;

/** One spectrum, as on the results pages: title and position, then the dot on its track. */
function drawStrip(ctx: Ctx, s: CardStrip, top: number, color: string, p: Palette): void {
  let base = top + 32;
  put(ctx, ellipsize(s.title, INNER, (t) => measure(ctx, TITLE, t)), PAD, base, TITLE, p.muted);
  if (twoRows(ctx, s)) base += 42;
  put(ctx, ellipsize(s.label, INNER, (t) => measure(ctx, LABEL, t)), WIDTH - PAD, base, LABEL, p.text, 'right');

  const ty = base + 38;
  const r = 19;
  const at = (pct: number) => PAD + r + (pct / 100) * (INNER - 2 * r);
  const pct = toPercent(s.score);
  rect(ctx, PAD, ty - 4.5, INNER, 9, 4.5);
  ctx.fillStyle = p.track;
  ctx.fill();
  rect(ctx, at(50) - 2, ty - 17, 4, 34, 2);
  ctx.fillStyle = p.border;
  ctx.fill();
  // How sure the app is: wider with less evidence. A cue, not a statistical interval.
  const half = (1 - Math.max(0, Math.min(1, s.confidence))) * 18 + 4;
  const lo = at(Math.max(0, pct - half));
  const hi = at(Math.min(100, pct + half));
  ctx.globalAlpha = 0.22;
  rect(ctx, lo, ty - 21, hi - lo, 42, 21);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 0.6;
  rect(ctx, at(Math.min(50, pct)), ty - 4.5, Math.abs(at(pct) - at(50)), 9, 4.5);
  ctx.fill();
  ctx.globalAlpha = 1;
  circle(ctx, at(pct), ty, r + 5, p.surface);
  circle(ctx, at(pct), ty, r, color);
  if (s.low) circle(ctx, at(pct), ty, r - 7, p.surface);

  const pf = font(600, 26);
  const half2 = INNER / 2 - 12;
  put(ctx, ellipsize(s.poles[0], half2, (t) => measure(ctx, pf, t)), PAD, ty + 55, pf, p.muted);
  put(ctx, ellipsize(s.poles[1], half2, (t) => measure(ctx, pf, t)), WIDTH - PAD, ty + 55, pf, p.muted, 'right');
}

const TRADITION_H = 128;

function drawTradition(ctx: Ctx, t: CardTradition, top: number, p: Palette): void {
  rect(ctx, PAD, top, INNER, TRADITION_H, 28);
  ctx.fillStyle = p.surface2;
  ctx.fill();
  const x = PAD + 32;
  const w = INNER - 64;
  put(ctx, t.label, x, top + 48, font(600, 28), p.muted);
  if (t.band) put(ctx, t.band, x + w, top + 48, font(700, 28), p.text, 'right');
  const nf = font(700, 42, DISPLAY);
  put(ctx, ellipsize(t.name, w, (s) => measure(ctx, nf, s)), x, top + 100, nf, p.text);
}

// --- Principles ----------------------------------------------------------------------------------

function drawPrinciples(ctx: Ctx, c: PrinciplesCard, p: Palette): void {
  drawHeader(ctx, c.name, 'principles', mix(p.mark, p.surface, 0.2), p);
  let y = drawLine(ctx, lineBreaks(ctx, c.line), p);

  // Which colour is which, as on the chart.
  const kf = font(600, 28);
  let x = PAD;
  for (const [label, color] of [
    [copy.results.rejects, p.reject],
    [copy.results.endorses, p.mark],
  ] as const) {
    rect(ctx, x, y + 6, 30, 20, 4);
    ctx.fillStyle = color;
    ctx.fill();
    x += 42 + put(ctx, label, x + 42, y + 26, kf, p.muted) + 36;
  }
  y += 52;

  const rows = c.bars.length + (c.skipAt === null ? 0 : 0.4);
  const row = Math.max(84, Math.min(104, (bodyEnd(c) - y) / rows));
  const mid = PAD + INNER / 2;
  const lf = font(600, 32);
  const wf = font(500, 28);
  c.bars.forEach((b, k) => {
    // Three dots where principles are left out, between the most endorsed and the most rejected.
    if (k === c.skipAt) {
      for (const dx of [-18, 0, 18]) circle(ctx, mid + dx, y + row * 0.18, 5, p.muted);
      y += row * 0.4;
    }
    const ww = measure(ctx, wf, b.words);
    put(ctx, ellipsize(b.label, INNER - ww - 24, (s) => measure(ctx, lf, s)), PAD, y + 32, lf, p.text);
    put(ctx, b.words, WIDTH - PAD, y + 32, wf, p.muted, 'right');
    const by = y + 48;
    ctx.globalAlpha = 0.55;
    rect(ctx, mid - 1.5, by - 10, 3, 46, 1.5);
    ctx.fillStyle = p.muted;
    ctx.fill();
    ctx.globalAlpha = b.low ? 0.45 : 1;
    const w = (Math.abs(b.score) * INNER) / 2;
    if (b.score >= 0) shape(ctx, mid, by, w, 26, [0, 8, 8, 0]);
    else shape(ctx, mid - w, by, w, 26, [8, 0, 0, 8]);
    ctx.fillStyle = b.score >= 0 ? p.mark : p.reject;
    ctx.fill();
    ctx.globalAlpha = 1;
    y += row;
  });
}

// --- Parts ---------------------------------------------------------------------------------------

/** An area card's tinted header: the app's name, the area's icon, and its name. */
function drawHeader(ctx: Ctx, name: string, iconName: IconName, tint: string, p: Palette): void {
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, WIDTH, HEAD);
  put(ctx, copy.appName, PAD, 108, font(800, 36, DISPLAY), p.text);
  const s = 124;
  const tx = WIDTH - PAD - s;
  rect(ctx, tx, PAD - 4, s, s, 34);
  ctx.fillStyle = p.surface;
  ctx.fill();
  drawIcon(ctx, iconName, tx + (s - 64) / 2, PAD - 4 + (s - 64) / 2, 64, p.text);
  const nf = font(800, 100, DISPLAY);
  put(ctx, ellipsize(name, INNER - s - 24, (t) => measure(ctx, nf, t)), PAD, HEAD - 52, nf, p.text);
}

const LINE = font(700, 54, DISPLAY);
/** The card's line under its header, broken onto up to two lines. */
const lineBreaks = (ctx: Ctx, line: string) => wrapParts(line, INNER, (s) => measure(ctx, LINE, s), 2);
/** From the header to where the rest can start. */
const lineHeight = (lines: readonly string[]) => 48 + 64 * lines.length;

/** Draws the line under the header, `shift` further down. Returns where the rest can start. */
function drawLine(ctx: Ctx, lines: readonly string[], p: Palette, shift = 0): number {
  lines.forEach((l, k) => put(ctx, l, PAD, HEAD + 76 + shift + 64 * k, LINE, p.text));
  return HEAD + shift + lineHeight(lines);
}

/** Draws text and returns its width. */
function put(ctx: Ctx, text: string, x: number, y: number, f: string, color: string, align: CanvasTextAlign = 'left'): number {
  ctx.font = f;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  return ctx.measureText(text).width;
}

function measure(ctx: Ctx, f: string, text: string): number {
  ctx.font = f;
  return ctx.measureText(text).width;
}

function circle(ctx: Ctx, x: number, y: number, r: number, fill: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => shape(ctx, x, y, w, h, [r, r, r, r]);

/** A rectangle path with its own radius at each corner: top left, top right, bottom right, bottom left. */
function shape(ctx: Ctx, x: number, y: number, w: number, h: number, [tl, tr, br, bl]: readonly [number, number, number, number]): void {
  const k = (r: number) => Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k(tl), y);
  ctx.arcTo(x + w, y, x + w, y + h, k(tr));
  ctx.arcTo(x + w, y + h, x, y + h, k(br));
  ctx.arcTo(x, y + h, x, y, k(bl));
  ctx.arcTo(x, y, x + w, y, k(tl));
  ctx.closePath();
}

function drawIcon(ctx: Ctx, name: IconName, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of ICONS[name]) ctx.stroke(new Path2D(d));
  ctx.restore();
}
