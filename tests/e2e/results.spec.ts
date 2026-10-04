// The results page as a whole: the written summary, the jump bar and the next steps, for a full
// persona and for someone who has only described their personality.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { parse, stringify } from 'yaml';
import { expect, test } from './fixtures.ts';
import { freshStart } from './helpers.ts';

/** Topics the analysis never suggests: sensitive ones, by their own flag or their domain's (see docs/ANALYSIS.md). */
const sensitiveDomains = new Set(
  (parse(readFileSync('content/domains.yaml', 'utf8')) as { id: string; sensitive?: boolean }[]).filter((d) => d.sensitive).map((d) => d.id),
);
const sensitive = new Set(
  readdirSync('content/topics', { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => parse(readFileSync(join('content/topics', f), 'utf8')) as { id: string; domain: string; sensitive?: boolean })
    .filter((t) => t.sensitive || sensitiveDomains.has(t.domain))
    .map((t) => t.id),
);
test('the list of sensitive topics is read from the content', () => {
  expect([...sensitive]).toEqual(expect.arrayContaining(['afterlife', 'aging_parents', 'god', 'supernatural']));
});
/** Words from the worldview spectrum, which the summary never uses. */
const WORLDVIEW = /natural world|\bGod\b|afterlife/i;

async function restorePersona(page: Page, persona: string): Promise<void> {
  const file = join(mkdtempSync(join(tmpdir(), 'whoami-')), 'backup.json');
  execFileSync('node', ['scripts/persona-backup.ts', persona, file]);
  await freshStart(page, '#/settings');
  await page.getByTestId('backup-file').setInputFiles(file);
  await page.getByTestId('restore-replace').click();
  await expect(page.getByText('Backup restored.')).toBeVisible();
  await page.getByTestId('nav-results').click();
}

async function suggestedTopics(page: Page): Promise<string[]> {
  return page.locator('[data-testid^="rec-explore-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice('rec-explore-'.length)));
}

test('the results open with a summary, a jump bar to each section, and next steps', async ({ page }) => {
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

  // The jump bar takes you to a section, puts its heading in view below the bar, and marks it current.
  await page.getByTestId('jump-tensions').click();
  const heading = page.locator('#sec-tensions h2');
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  await expect(page.getByTestId('jump-tensions')).toHaveAttribute('aria-current', 'location');
  const below = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="jump-bar"]')!.getBoundingClientRect();
    return document.querySelector('#sec-tensions h2')!.getBoundingClientRect().top >= bar.bottom - 1;
  });
  expect(below).toBe(true);

  // Next steps: both sides of the firmest positions, no sensitive topics to explore, three reflections at most.
  await expect(page.getByTestId('next-read').locator('[data-testid^="rec-case-"]').first()).toBeVisible();
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
  // Only the sections that have something to show are listed.
  await expect(page.getByTestId('jump-personality')).toBeVisible();
  for (const id of ['worldview', 'principles', 'positions']) await expect(page.getByTestId(`jump-${id}`)).toHaveCount(0);
  await expect(page.getByTestId('political-map')).toHaveCount(0);

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

test('the political traditions: where the answers sit, the map table, and readings from inside and out', async ({ page }) => {
  await restorePersona(page, 'tests/sim/personas/religious_conservative.yaml');

  // Named only as reference points, in the summary and the Politics section.
  const traditions = page.getByTestId('traditions');
  await expect(traditions).toHaveAttribute('data-status', /^(match|between)$/);
  await expect(page.getByTestId('summary-tradition')).toContainText('Of the political traditions compared here, your answers sit');
  await expect(page.getByTestId('summary-tradition')).toContainText('conservatism');
  await expect(traditions.locator('[data-testid^="tradition-"]')).toHaveCount(3);
  await expect(traditions).not.toContainText(/you are an? /i);

  // The map marks every tradition, and its table says where each sits, in words.
  const table = page.getByTestId('map-table');
  await table.locator('summary').click();
  await expect(table.locator('tbody tr')).toHaveCount(12);
  await expect(table.locator('tbody tr').first()).toContainText('You');

  // Readings: from inside the tradition, and critiques from outside it.
  const readings = page.getByTestId('next-readings').locator('[data-testid^="rec-read-"]');
  expect(await readings.count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId('next-readings')).toContainText('from inside');
});
