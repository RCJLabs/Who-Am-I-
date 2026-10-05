// The share cards' colours and text fitting: pure helpers, kept apart from the canvas drawing
// (render.ts) so they can be tested without a browser.
import type { PatternArea } from '../view.ts';

export type CardTheme = 'light' | 'dark';

/** The app's own colours, for drawing outside the page. layout.test.ts keeps them in step with app.css. */
export interface Palette {
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  border: string;
  track: string;
  accent: string;
  mark: string;
  reject: string;
  area: Record<PatternArea, string>;
}

/** The custom property in app.css that each colour mirrors. */
export const TOKENS: Record<Exclude<keyof Palette, 'area'>, string> = {
  surface: '--surface',
  surface2: '--surface-2',
  text: '--text',
  muted: '--muted',
  border: '--border',
  track: '--track',
  accent: '--accent',
  mark: '--chart-mark',
  reject: '--chart-reject',
};

export const PALETTES: Record<CardTheme, Palette> = {
  light: {
    surface: '#ffffff',
    surface2: '#f1efea',
    text: '#1c1c1e',
    muted: '#66666e',
    border: '#e4e1da',
    track: '#e6e3dc',
    accent: '#4f46e5',
    mark: '#4f46e5',
    reject: '#eb6834',
    area: { politics: '#4a3aa7', personality: '#e87ba4', thinking: '#eda100', values: '#1baf7a' },
  },
  dark: {
    surface: '#1b1b1f',
    surface2: '#232328',
    text: '#ececf1',
    muted: '#9b9ba6',
    border: '#2d2d34',
    track: '#2d2d34',
    accent: '#8b8cf8',
    mark: '#7f80f3',
    reject: '#d95926',
    area: { politics: '#9085e9', personality: '#d55181', thinking: '#c98500', values: '#199e70' },
  },
};

/** `color-mix(in srgb, a t, b)` for two #rrggbb colours: `t` of `a`, the rest `b`. */
export function mix(a: string, b: string, t: number): string {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v * t + y[i]! * (1 - t)).toString(16).padStart(2, '0')).join('')}`;
}

/** The text, shortened with an ellipsis until it fits the width. */
export function ellipsize(text: string, width: number, measure: (s: string) => number): string {
  if (measure(text) <= width) return text;
  let t = text;
  while (t.length > 1 && measure(`${t.trimEnd()}…`) > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/**
 * Breaks a line made of parts ("Strongly Flexible · Strongly Intuition") between its parts when it
 * doesn't fit on one line and each part fits on its own; otherwise as `wrap` does.
 */
export function wrapParts(text: string, width: number, measure: (s: string) => number, maxLines = Infinity, sep = ' · '): string[] {
  if (measure(text) <= width || !text.includes(sep)) return wrap(text, width, measure, maxLines);
  const parts = text.split(sep);
  return parts.length <= maxLines && parts.every((p) => measure(p) <= width) ? parts : wrap(text, width, measure, maxLines);
}

/** Breaks text into lines that fit the width, at spaces; past `maxLines`, the last line ends in an ellipsis. */
export function wrap(text: string, width: number, measure: (s: string) => number, maxLines = Infinity): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  const kept = lines.length > maxLines ? [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(' ')] : lines;
  return kept.map((l) => ellipsize(l, width, measure));
}
