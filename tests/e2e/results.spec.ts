// The results as a whole: the overview (summary, pattern, a link to each area, next steps) and the
// area pages, for a full persona and for someone who has only described their personality.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { parse, stringify } from 'yaml';
import { expect, test } from './fixtures.ts';
import { restorePersona, sensitiveTopics } from './helpers.ts';

/** Topics the analysis never suggests (see docs/ANALYSIS.md). */
const sensitive = sensitiveTopics();
test('the list of sensitive topics is read from the content', () => {
  expect([...sensitive]).toEqual(expect.arrayContaining(['afterlife', 'aging_parents', 'god', 'supernatural']));
});
/** Words from the worldview spectrum, which the summary never uses. */
const WORLDVIEW = /natural world|\bGod\b|afterlife/i;

async function suggestedTopics(page: Page): Promise<string[]> {
  return page.locator('[data-testid^="rec-explore-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice('rec-explore-'.length)));
}

test('the results open on an overview: a summary, the pattern, a link to each area, and next steps', async ({ page }) => {
  const persona = 'tests/sim/personas/religious_conservative.yaml';
  const { topics, expect: expected } = parse(readFileSync(persona, 'utf8')) as { topics: string[]; expect: { tensions: string[] } };
  await restorePersona(page, persona);

  // The summary: a headline, a short paragraph and three numbers, with nothing from the worldview answers.
  const summary = page.getByTestId('results-summary');
  await expect(page.getByTestId('summary-headline')).toContainText('Tradition');
  await expect(summary).toContainText('Politically, you lean toward');
  await expect(page.getByTestId('stat-topics')).toContainText(String(topics.length));
  await expect(page.getByTestId('stat-challenges')).toBeVisible();
  await expect(page.getByTestId('stat-tensions')).toContainText(String(expected.tensions.length));
  await expect(summary).not.toContainText(WORLDVIEW);

  // The pattern: a line per spectrum, never the worldview one; tapping a line names it.
  const spokes = page.locator('[data-testid^="spoke-"]');
  expect(await spokes.count()).toBeGreaterThanOrEqual(10);
  await expect(page.getByTestId('spoke-beyond_nature')).toHaveCount(0);
  await page.getByTestId('spoke-cultural').click();
  await expect(page.getByTestId('spoke-cultural')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('pattern-status')).toContainText(/Cultural · (Strongly )?Tradition/);
  // The ring is one stop for the keyboard; arrow keys move round it a line at a time.
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('spoke-cultural')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('spoke-diplomatic')).toBeFocused();
  await expect(page.getByTestId('pattern-status')).toContainText('Diplomatic ·');
  await expect(page.locator('[data-testid^="spoke-"][tabindex="0"]')).toHaveCount(1);
  await expect(page.getByTestId('firmest')).not.toContainText(WORLDVIEW);
  await expect(page.getByTestId('area-worldview')).toContainText('Sensitive: kept out of your summary');

  // Each area has its own page, which opens at its title; Results goes back to where you were.
  const link = page.getByTestId('area-tensions');
  await link.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  expect(y).toBeGreaterThan(0);
  await link.click();
  await expect(page.locator('#sec-tensions h1')).toBeFocused();
  await expect(page.getByTestId('tension-row').first()).toBeVisible();
  // Each principle's card leads with its most pressing pair, worded as a question to think over.
  const card = page.locator('[data-testid^="tension-group-"]').first();
  await expect(card).toContainText(/You (endorsed|were neutral on)/);
  await expect(card).toContainText('Think it through');
  await page.getByTestId('area-back').click();
  await expect(summary).toBeVisible();
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(Math.round(y));
  // The open tensions tile leads to the same page.
  await page.getByTestId('stat-tensions').getByRole('link').click();
  await expect(page.getByTestId('section-tensions')).toBeVisible();
  await page.goBack();

  // Next steps: both sides of the firmest positions, two at first and the rest on request, no
  // sensitive topics to explore, three reflections at most.
  const read = page.getByTestId('next-read').locator('[data-testid^="rec-case-"]');
  await expect(read).toHaveCount(2);
  await page.getByTestId('next-more-read').click();
  expect(await read.count()).toBeGreaterThan(2);
  for (const topic of await suggestedTopics(page)) expect(sensitive.has(topic), topic).toBe(false);
  const reflections = page.locator('[data-testid^="rec-reflect-"]');
  await expect(reflections).toHaveCount(3);

  // A reflection opens the tension it asks about.
  const href = (await reflections.first().getAttribute('href'))!;
  await reflections.first().click();
  await expect(page.getByTestId('tension')).toHaveAttribute('data-key', decodeURIComponent(href.replace('#/tension/', '')));
});

test('someone who has only described their personality gets a summary of that, and where to start', async ({ page }) => {
  // Outgoing and warm, middling otherwise.
  const answers: Record<string, number> = {};
  for (const trait of ['e', 'a', 'c', 'n', 'i']) {
    for (const k of [1, 2, 3, 4]) answers[`mini_ipip.${trait}${k}`] = 3;
  }
  Object.assign(answers, { 'mini_ipip.e1': 5, 'mini_ipip.e2': 1, 'mini_ipip.e3': 5, 'mini_ipip.e4': 1, 'mini_ipip.a1': 5, 'mini_ipip.a2': 1, 'mini_ipip.a3': 5, 'mini_ipip.a4': 1 });
  const persona = join(mkdtempSync(join(tmpdir(), 'whoami-')), 'personality.yaml');
  writeFileSync(persona, stringify({ topics: ['mini_ipip'], answers }));
  await restorePersona(page, persona);

  await expect(page.getByTestId('summary-headline')).toContainText('You describe yourself as');
  await expect(page.getByTestId('stat-topics')).toContainText('1');
  // The pattern draws the four traits the summary may name, never emotional reactivity.
  await expect(page.locator('[data-testid^="spoke-"]')).toHaveCount(4);
  await expect(page.getByTestId('spoke-neuroticism')).toHaveCount(0);
  await expect(page.getByTestId('firm-extraversion')).toContainText('Strongly Outgoing');
  // Only the areas that have something to show are listed; the others say what's missing.
  await expect(page.getByTestId('area-personality')).toContainText('Strongly Outgoing');
  for (const id of ['worldview', 'principles', 'positions']) await expect(page.getByTestId(`area-${id}`)).toHaveCount(0);
  await expect(page.getByTestId('area-politics')).toContainText('Not enough answers yet');
  await page.getByTestId('area-politics').click();
  await expect(page.getByTestId('section-politics')).toBeVisible();
  await page.getByTestId('map-open').click();
  await expect(page.getByTestId('map-card')).toContainText('to see your political map');
  await expect(page.getByTestId('political-map')).toHaveCount(0);
  await page.getByTestId('area-back').click();

  // Nothing to read both sides of or reflect on yet: just three topics to start, none of them sensitive.
  await expect(page.getByTestId('next-read')).toHaveCount(0);
  await expect(page.getByTestId('next-reflect')).toHaveCount(0);
  const suggested = await suggestedTopics(page);
  expect(suggested).toHaveLength(3);
  for (const topic of suggested) expect(sensitive.has(topic), topic).toBe(false);

  // Links from research: closed until opened, one link from the clearest lean, and it remembers
  // being opened. Warm answers add nothing: no link rests on agreeableness.
  const links = page.getByTestId('next-links');
  await expect(links).toBeVisible();
  await expect(links).toContainText('From your personality answers only.');
  const link = page.getByTestId('rec-link-enterprising');
  await expect(link).toBeHidden();
  await links.locator('summary').click();
  await expect(link).toBeVisible();
  await expect(link).toContainText('Interest in leading and negotiating');
  await expect(link).toContainText('people whose answers lean toward “Outgoing” report a little more interest in leading or negotiating');
  await expect(link).toContainText('Your answers lean toward “Outgoing”');
  await expect(page.locator('[data-testid^="rec-link-"]')).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId('rec-link-enterprising')).toBeVisible();

  // Settings can turn them off.
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('setting-links').uncheck();
  await page.getByTestId('nav-results').click();
  await expect(page.getByTestId('summary-headline')).toBeVisible();
  await expect(page.getByTestId('next-links')).toHaveCount(0);
});

test('the political traditions: side by side with the answers, readings from inside and out, and the map', async ({ page }) => {
  await restorePersona(page, 'tests/sim/personas/religious_conservative.yaml');

  // Named only as reference points, in the summary and on the Politics page.
  await expect(page.getByTestId('summary-tradition')).toContainText('Of the political traditions compared here, your answers sit');
  await expect(page.getByTestId('summary-tradition')).toContainText('conservatism');
  await page.getByTestId('area-politics').click();
  const traditions = page.getByTestId('traditions');
  await expect(traditions).toHaveAttribute('data-status', /^(match|between)$/);
  await expect(traditions.locator('[data-testid^="tradition-"]')).toHaveCount(3);
  await expect(traditions).not.toContainText(/you are an? /i);

  // The nearest opens as "You and …": each spectrum side by side, in words too, and readings from
  // inside the tradition and critiques from outside it.
  const nearest = traditions.locator('[data-testid^="you-and-"]').first();
  await expect(nearest).toBeVisible();
  await expect(nearest).toContainText('You and ');
  await expect(nearest).toContainText('You: ');
  expect(await nearest.locator('[data-testid^="rec-read-"]').count()).toBeGreaterThanOrEqual(2);
  await expect(nearest).toContainText('from inside');

  // The map is one tap away: the nearest traditions numbered as in the list, the rest on request,
  // each named on a tap, and a second view with the other two spectrums.
  await page.getByTestId('map-open').click();
  const map = page.getByTestId('political-map');
  await expect(map).toContainText('Economic: Markets');
  const marks = page.locator('[data-testid^="map-trad-"]');
  await expect(marks).toHaveCount(3);
  // The nearest is drawn last, on top, so it can always be tapped.
  await marks.last().click();
  await expect(page.getByTestId('map-status')).toContainText(/ fit|overlap/);
  await page.getByTestId('map-show-all').click();
  await expect(marks).toHaveCount(11);
  await page.getByTestId('map-view-cultural-diplomatic').click();
  await expect(map).toContainText('Cultural: ');
  await expect(marks).toHaveCount(11);

  // Its table says where each sits, in words.
  const table = page.getByTestId('map-table');
  await table.locator('summary').click();
  await expect(table.locator('tbody tr')).toHaveCount(12);
  await expect(table.locator('tbody tr').first()).toContainText('You');

  // Readings live with their tradition now, not among the next steps.
  await page.getByTestId('area-back').click();
  await expect(page.getByTestId('next-steps')).toBeVisible();
  await expect(page.locator('[data-testid^="rec-read-"]')).toHaveCount(0);
});
