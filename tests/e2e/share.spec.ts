// Share cards: images drawn on this device from answers that could be shared, handed to the share
// sheet or saved only when asked. (The guard fixture fails any test that contacts another origin.)
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Download, Page } from '@playwright/test';
import { parse, stringify } from 'yaml';
import { expect, test } from './fixtures.ts';
import { freshStart, openArea, restorePersona, sensitiveTopics } from './helpers.ts';

/** Never on a card: worldview, and the emotional reactivity scale. */
const KEPT_OFF = /natural world|\bGod\b|afterlife|Reactive|Even-keeled|Emotional reactivity/i;

/** The religious conservative, who has also described their personality, very reactive included. */
function persona(): { file: string; topics: string[] } {
  const base = parse(readFileSync('tests/sim/personas/religious_conservative.yaml', 'utf8')) as { topics: string[]; answers: Record<string, unknown> };
  const answers: Record<string, number> = {};
  for (const trait of ['e', 'a', 'c', 'n', 'i']) for (const k of [1, 2, 3, 4]) answers[`mini_ipip.${trait}${k}`] = k % 2 ? 5 : 1;
  const file = join(mkdtempSync(join(tmpdir(), 'whoami-')), 'persona.yaml');
  const topics = [...base.topics, 'mini_ipip'];
  writeFileSync(file, stringify({ topics, answers: { ...base.answers, ...answers } }));
  return { file, topics };
}

/** Waits until every card's image has been drawn and loaded. */
async function drawn(page: Page): Promise<{ id: string; w: number; h: number; alt: string }[]> {
  const images = page.locator('[data-testid^="share-image-"]');
  await expect(images).toHaveCount(await page.locator('[data-testid^="share-card-"]').count());
  await expect.poll(() => images.evaluateAll((els) => els.every((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0))).toBe(true);
  return images.evaluateAll((els) =>
    els.map((e) => {
      const img = e as HTMLImageElement;
      return { id: img.dataset.testid!.slice('share-image-'.length), w: img.naturalWidth, h: img.naturalHeight, alt: img.alt };
    }),
  );
}

/** A saved file's name, and its size as a PNG says. */
async function png(download: Download): Promise<{ name: string; w: number; h: number }> {
  const bytes = readFileSync((await download.path())!);
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return { name: download.suggestedFilename(), w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
}

test('cards are drawn from answers that could be shared, and saved as images', async ({ page }) => {
  const { file, topics } = persona();
  await restorePersona(page, file);
  await page.getByTestId('share-open').click();
  await expect(page.getByRole('heading', { name: 'Share a card' })).toBeFocused();

  // The pattern, then each area there's enough for; never worldview or taste.
  const cards = await drawn(page);
  expect(cards.map((c) => c.id)).toEqual(['pattern', 'politics', 'values', 'thinking', 'personality', 'principles']);
  for (const c of cards) {
    expect([c.id, c.w, c.h]).toEqual([c.id, 1080, 1350]);
    expect(c.alt, c.id).not.toMatch(KEPT_OFF);
  }
  const alt = Object.fromEntries(cards.map((c) => [c.id, c.alt]));
  expect(alt.pattern).toMatch(/^Who Am I, My pattern\. \d+ spectrums: Politics, Personality/);
  expect(alt.personality).toContain('Extraversion: Strongly Outgoing');
  expect(alt.politics).toMatch(/(Closest political tradition|Between two political traditions): [^.]*conservatism/);
  // Counted from shareable topics only: the worldview topics this persona answered aren't.
  const sensitive = sensitiveTopics();
  expect(topics.some((t) => sensitive.has(t))).toBe(true);
  for (const c of cards) expect(c.alt).toMatch(new RegExp(`My results so far · ${topics.filter((t) => !sensitive.has(t)).length} topics\\.$`));

  // Saving makes a 1080×1350 PNG of the card on screen.
  await expect(page.getByTestId('share-card-pattern')).toHaveAttribute('aria-current', 'true');
  const [first] = await Promise.all([page.waitForEvent('download'), page.getByTestId('share-save').click()]);
  expect(await png(first)).toEqual({ name: 'who-am-i-pattern.png', w: 1080, h: 1350 });
  await expect(page.getByText('Image saved.')).toBeVisible();

  // The arrows and dots move between cards.
  await page.getByTestId('share-next').click();
  await expect(page.getByTestId('share-card-politics')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('share-prev')).toBeEnabled();
  await expect(page.getByTestId('share-differs')).toHaveCount(0);
  await page.getByTestId('share-dot-principles').click();
  await expect(page.getByTestId('share-card-principles')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('share-next')).toBeDisabled();
  // This persona's answers on religion move some principles, which the card leaves out, so it says so.
  await expect(page.getByTestId('share-differs')).toContainText('it can differ from your Principles page');
  const [last] = await Promise.all([page.waitForEvent('download'), page.getByTestId('share-save').click()]);
  expect((await png(last)).name).toBe('who-am-i-principles.png');

  // Light or dark: every card is drawn again.
  const before = await page.getByTestId('share-image-pattern').getAttribute('src');
  const dark = page.getByTestId('share-theme-dark');
  await dark.check({ force: true });
  await expect(dark).toBeChecked();
  await expect(page.getByTestId('share-image-pattern')).not.toHaveAttribute('src', before!);
  expect((await drawn(page)).length).toBe(6);

  // Back to the overview.
  await page.getByTestId('share-back').click();
  await expect(page.getByTestId('results-summary')).toBeVisible();
});

test("an area's page opens its card, and the share sheet gets the image", async ({ page }) => {
  // Stand in for a phone's share sheet, and note what it was given.
  await page.addInitScript(() => {
    const shared: { name: string; type: string; size: number }[] = [];
    Object.assign(window, { shared });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        for (const f of data.files ?? []) shared.push({ name: f.name, type: f.type, size: f.size });
      },
    });
  });
  await restorePersona(page, 'tests/sim/personas/religious_conservative.yaml');
  await openArea(page, 'values');
  await page.getByTestId('area-share').click();
  await expect(page).toHaveURL(/#\/share\/values$/);
  await expect(page.getByTestId('share-card-values')).toHaveAttribute('aria-current', 'true');
  await drawn(page);
  await page.getByTestId('share-share').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { shared: unknown[] }).shared)).toEqual([
    { name: 'who-am-i-values.png', type: 'image/png', size: expect.any(Number) },
  ]);

  // Without personality answers there's no personality card, and its page offers none.
  await expect(page.getByTestId('share-card-personality')).toHaveCount(0);
  await openArea(page, 'personality');
  await expect(page.getByTestId('area-share')).toHaveCount(0);
});

test('with nothing answered there is no card to share', async ({ page }) => {
  await freshStart(page, '#/share');
  await expect(page.getByText('Answer a few more topics to make a card.')).toBeVisible();
  await expect(page.locator('[data-testid^="share-card-"]')).toHaveCount(0);
});
