// Renders the app icons from SVG with headless Chromium (already a dev dependency via Playwright).
//   node scripts/gen-icons.ts
// Outputs are committed; rerun only when the design changes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const ACCENT = '#4f46e5';

/** A head above a spectrum, with your position marked: "where do you stand?" */
function mark(scale = 1): string {
  const t = (x: number) => 256 + (x - 256) * scale;
  return `
    <circle cx="256" cy="${t(196)}" r="${86 * scale}" fill="none" stroke="#fff" stroke-width="${34 * scale}"/>
    <rect x="${t(118)}" y="${t(338)}" width="${276 * scale}" height="${28 * scale}" rx="${14 * scale}" fill="#fff" opacity=".45"/>
    <circle cx="${t(318)}" cy="${t(352)}" r="${34 * scale}" fill="#fff"/>`;
}

const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${ACCENT}"/>${mark()}</svg>`;
// Maskable icons are cropped to a circle or squircle by the launcher: full bleed, content in the safe zone.
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${ACCENT}"/>${mark(0.78)}</svg>`;

const outputs: { file: string; svg: string; size: number; transparent: boolean }[] = [
  { file: 'public/icons/icon-192.png', svg: rounded, size: 192, transparent: true },
  { file: 'public/icons/icon-512.png', svg: rounded, size: 512, transparent: true },
  { file: 'public/icons/maskable-512.png', svg: fullBleed, size: 512, transparent: false },
  { file: 'public/icons/apple-touch-icon.png', svg: fullBleed, size: 180, transparent: false },
];

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/favicon.svg', rounded + '\n');

const browser = await chromium.launch();
for (const o of outputs) {
  const page = await browser.newPage({ viewport: { width: o.size, height: o.size } });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${o.svg.replace('<svg ', `<svg width="${o.size}" height="${o.size}" `)}</body></html>`,
  );
  await page.screenshot({ path: o.file, omitBackground: o.transparent });
  await page.close();
  console.log(`wrote ${o.file}`);
}
await browser.close();
