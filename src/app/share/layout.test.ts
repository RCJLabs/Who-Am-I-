import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PATTERN_AREAS } from '../view.ts';
import { ellipsize, mix, PALETTES, TOKENS, wrap, wrapParts } from './layout.ts';

/** The custom properties set in one block of app.css. */
function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

describe('share card layout', () => {
  it("draws in the app's own colours, light and dark", () => {
    const css = readFileSync('src/app/styles/app.css', 'utf8');
    const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {'))));
    const darkAt = css.indexOf(':root {', css.indexOf('@media (prefers-color-scheme: dark)'));
    const dark = tokens(css.slice(darkAt, css.indexOf('}', darkAt)));
    for (const [theme, set] of [['light', light], ['dark', dark]] as const) {
      const p = PALETTES[theme];
      for (const [key, prop] of Object.entries(TOKENS)) expect([theme, prop, p[key as keyof typeof TOKENS]]).toEqual([theme, prop, set[prop]]);
      for (const { area } of PATTERN_AREAS) expect([theme, area, p.area[area]]).toEqual([theme, area, set[`--area-${area}`]]);
    }
  });

  it('mixes colours like color-mix in sRGB', () => {
    expect(mix('#000000', '#ffffff', 0.25)).toBe('#bfbfbf');
    expect(mix('#4a3aa7', '#ffffff', 1)).toBe('#4a3aa7');
    expect(mix('#4a3aa7', '#ffffff', 0)).toBe('#ffffff');
  });

  it('wraps at spaces, and ends with an ellipsis what does not fit', () => {
    const measure = (s: string) => s.length * 10;
    expect(wrap('Strongly Progress · Global', 150, measure)).toEqual(['Strongly', 'Progress ·', 'Global']);
    expect(wrap('Strongly Progress · Global', 200, measure)).toEqual(['Strongly Progress ·', 'Global']);
    expect(wrap('Strongly Progress · Global', 260, measure)).toEqual(['Strongly Progress · Global']);
    expect(wrap('one two three four', 90, measure, 2)).toEqual(['one two', 'three fo…']);
    expect(wrap('', 100, measure)).toEqual([]);
    expect(ellipsize('Intellect & Imagination', 100, measure)).toBe('Intellect…');
    expect(ellipsize('Short', 100, measure)).toBe('Short');
  });

  it('breaks a line of parts between the parts', () => {
    const measure = (s: string) => s.length * 10;
    expect(wrapParts('Strongly Flexible · Strongly Intuition', 300, measure, 2)).toEqual(['Strongly Flexible', 'Strongly Intuition']);
    expect(wrapParts('Leans Liberty · Global', 300, measure, 2)).toEqual(['Leans Liberty · Global']);
    // A part too long for a line, or more parts than lines: wrapped as words.
    expect(wrapParts('Strongly Others welfare · Change', 200, measure, 2)).toEqual(['Strongly Others', 'welfare · Change']);
    expect(wrapParts('Most endorsed: Care and Liberty', 200, measure, 2)).toEqual(['Most endorsed: Care', 'and Liberty']);
  });
});
