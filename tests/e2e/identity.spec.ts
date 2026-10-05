// Answers about you: left out of backups and restores unless ticked, and removable for real.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { freshStart } from './helpers.ts';

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

/** Event ids in IndexedDB, read directly rather than through the app. */
function storedIds(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((done, fail) => {
        const open = indexedDB.open('whoami-events');
        open.onerror = () => fail(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction('events').objectStore('events').getAllKeys();
          get.onsuccess = () => {
            open.result.close();
            done((get.result as string[]).sort());
          };
        };
      }),
  );
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
