// Answers about you: folded away on the topic list, hashed in URLs, shown only when asked, never in
// the summary or on a card, left out of backups and restores unless ticked, and removable for real.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { freshStart, restorePersona } from './helpers.ts';

/** What's stored in IndexedDB, read directly rather than through the app: [event id, item] pairs. */
function stored(page: Page): Promise<[string, string][]> {
  return page.evaluate(
    () =>
      new Promise<[string, string][]>((done, fail) => {
        const open = indexedDB.open('whoami-events');
        open.onerror = () => fail(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction('events').objectStore('events').getAll();
          get.onsuccess = () => {
            open.result.close();
            done((get.result as { id: string; item: string }[]).map((e) => [e.id, e.item] as [string, string]).sort());
          };
        };
      }),
  );
}

const storedIds = async (page: Page) => (await stored(page)).map(([id]) => id);
const storedAboutYou = async (page: Page) => (await stored(page)).map(([, item]) => item).filter((i) => i.startsWith('about_')).sort();

const event = (id: string, item: string, r: object) => ({ id, item, r, at: Number(id.slice(1)), cv: 'old' });

/** A backup holding one ordinary answer and answers about you, two of them to the same question. */
function backupFile(): string {
  const file = join(mkdtempSync(join(tmpdir(), 'whoami-')), 'backup.json');
  const backup = {
    format: 'whoami.backup',
    version: 1,
    exportedAt: '2026-10-01T12:00:00.000Z',
    appVersion: '0.1.0',
    contentVersion: 'old',
    events: [
      event('e1', 'abortion.stance', { kind: 'scale', step: 4 }),
      event('e2', 'about_test.first', { kind: 'option', option: 'a' }),
      event('e3', 'about_test.first', { kind: 'option', option: 'b' }),
      event('e4', 'about_test.second', { kind: 'declined' }),
    ],
    resolutions: [],
  };
  writeFileSync(file, JSON.stringify(backup));
  return file;
}

async function restore(page: Page, file: string, withIdentity: boolean): Promise<void> {
  await page.getByTestId('backup-file').setInputFiles(file);
  await expect(page.getByTestId('restore-identity')).not.toBeChecked();
  if (withIdentity) await page.getByTestId('restore-identity').check();
  await page.getByTestId('restore-merge').click();
  // The dialog closes once the restore is written.
  await expect(page.getByTestId('restore-merge')).toBeHidden();
}

async function savedEvents(page: Page): Promise<string[]> {
  const download = page.waitForEvent('download');
  await page.getByTestId('backup-download').click();
  const path = await (await download).path();
  return (JSON.parse(readFileSync(path, 'utf8')) as { events: { id: string }[] }).events.map((e) => e.id);
}

/** Every share card's alt text, once drawn. */
async function cardTexts(page: Page): Promise<string[]> {
  const images = page.locator('[data-testid^="share-image-"]');
  await expect(images).toHaveCount(await page.locator('[data-testid^="share-card-"]').count());
  await expect.poll(() => images.evaluateAll((els) => els.every((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0))).toBe(true);
  return images.evaluateAll((els) => els.map((e) => (e as HTMLImageElement).alt));
}

/** Words from the answers given below, which must never show outside the About you page. */
const ABOUT_YOU = /Bisexual|Straight|attracted|orientation|A woman|transgender|grandchildren/i;

test('answers about you come back from a backup only when ticked, leave in one only when ticked, and can be removed', async ({ page }) => {
  const file = backupFile();
  await freshStart(page, '#/settings');

  // Left out by default: only the ordinary answer comes back, and nothing about you shows.
  await restore(page, file, false);
  expect(await storedIds(page)).toEqual(['e1']);
  await expect(page.getByTestId('settings-identity')).toHaveCount(0);
  await expect(page.getByTestId('backup-identity')).toHaveCount(0);

  // Ticked: they come back, but only the newest answer to each question.
  await restore(page, file, true);
  expect(await storedIds(page)).toEqual(['e1', 'e3', 'e4']);
  await expect(page.getByTestId('settings-identity')).toBeVisible();

  // A backup leaves them out unless the box is ticked, and the box doesn't stay ticked.
  expect(await savedEvents(page)).toEqual(['e1']);
  await page.getByTestId('backup-identity').check();
  expect(await savedEvents(page)).toEqual(['e1', 'e3', 'e4']);
  await expect(page.getByTestId('backup-identity')).not.toBeChecked();

  // Removing them deletes them from storage, and the other answers stay.
  await page.getByTestId('identity-remove').click();
  await page.getByTestId('identity-remove-confirm').click();
  await expect(page.getByText('Answers about you removed.')).toBeVisible();
  expect(await storedIds(page)).toEqual(['e1']);
  await expect(page.getByTestId('settings-identity')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('backup-download')).toBeVisible();
  await expect(page.getByTestId('settings-identity')).toHaveCount(0);
});

test('questions about you stay folded away, leave no readable trail, and show only when asked', async ({ page }) => {
  await restorePersona(page, 'tests/sim/personas/religious_conservative.yaml');

  // Folded on the topic list, with no titles or progress, until asked for each visit.
  await page.getByTestId('nav-topics').click();
  await expect(page.getByTestId('about-you')).toBeVisible();
  await expect(page.getByTestId('topic-about_orientation')).toHaveCount(0);
  await page.getByTestId('about-you-open').click();
  await expect(page.getByTestId('about-you-note')).toBeVisible();

  // The topic's URL doesn't name it.
  await page.getByTestId('topic-about_orientation').click();
  await expect(page.locator('article.question, [data-testid="intro-start"]').first()).toBeVisible();
  expect(new URL(page.url()).hash).toMatch(/^#\/m\/~[0-9a-z]+$/);
  await page.getByTestId('intro-start').click();

  // "Choose any" words, with no "None of these"; then attraction, as the words leave room.
  await expect(page.getByTestId('none-words')).toHaveCount(0);
  await expect(page.getByTestId('unsure-words')).toHaveCount(0);
  await expect(page.getByTestId('declined-words')).toBeVisible();
  await page.getByTestId('opt-words-bisexual').click();
  await page.getByTestId('next-words').click();
  await page.getByTestId('opt-attraction-yes').click();
  await page.getByTestId('opt-attracted_to-men').click();
  await page.getByTestId('opt-attracted_to-women').click();
  await page.getByTestId('next-attracted_to').click();
  await page.getByTestId('opt-romantic_same-same').click();
  await expect(page.getByTestId('topic-done')).toBeVisible();
  await expect(page.getByTestId('backup-nudge')).toHaveCount(0);
  expect(await storedAboutYou(page)).toEqual(['about_orientation.attracted_to', 'about_orientation.attraction', 'about_orientation.romantic_same', 'about_orientation.words'].sort());

  // Reviewing goes to the About you page, in place of the questions.
  await page.getByTestId('review-answers').click();
  await expect(page.getByTestId('section-you')).toBeVisible();
  await expect(page.getByTestId('identity-answers')).toHaveCount(0);
  await page.getByTestId('identity-show').click();
  await expect(page.getByTestId('identity-answers')).toContainText('Bisexual');
  await expect(page.getByTestId('identity-answers')).toContainText('Men, Women');

  // Going to the background hides them again.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('identity-answers')).toHaveCount(0);
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { value: false, configurable: true }));

  // A changed answer replaces the old one, and the answers it hides are deleted.
  await page.getByTestId('identity-show').click();
  await page.getByTestId('identity-answer-about_orientation.words').getByRole('link').click();
  expect(new URL(page.url()).hash).not.toMatch(/about|orientation|words/);
  await page.getByTestId('opt-words-bisexual').click();
  await page.getByTestId('opt-words-straight').click();
  await page.getByTestId('next-words').click();
  await expect(page.getByTestId('section-you')).toBeVisible();
  // Saved, not just shown: a failed write raises the storage warning.
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await storedAboutYou(page)).toEqual(['about_orientation.words']);
  await page.getByTestId('identity-show').click();
  await expect(page.getByTestId('identity-answers')).toContainText('Straight (heterosexual)');
  await expect(page.getByTestId('identity-answers')).not.toContainText('Men, Women');

  // Leaving a topic about you leaves no way back into it.
  await page.getByTestId('nav-topics').click();
  await page.getByTestId('about-you-open').click();
  await page.getByTestId('topic-about_family').click();
  await page.getByTestId('flow-exit').click();
  await expect(page.getByTestId('about-you')).toBeVisible();
  await page.goBack();
  expect(new URL(page.url()).hash).not.toMatch(/^#\/m\//);

  // The overview names the page but nothing on it; the cards and the summary never mention it.
  await page.goto('#/results');
  await expect(page.getByTestId('area-you')).toContainText('Private: shown only when you ask');
  await expect(page.locator('main, .page').first()).not.toContainText(ABOUT_YOU);
  await page.getByTestId('share-open').click();
  for (const alt of await cardTexts(page)) expect(alt).not.toMatch(ABOUT_YOU);
});
