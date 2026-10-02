import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from './fixtures.ts';
import { freshStart } from './helpers.ts';

test('the security policy is in place and the app works offline after the first visit', async ({ page, context }) => {
  await freshStart(page);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /connect-src 'self'/);

  // Wait for the service worker to take control, then go offline.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Who Am I', level: 1 })).toBeVisible();
  await page.getByTestId('nav-topics').click();
  await page.getByTestId('topic-abortion').click();
  await expect(page.locator('article.question')).toBeVisible();
});

test('a restored backup brings back answers and the tensions they imply', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'whoami-'));
  const file = join(dir, 'conservative.json');
  execFileSync('node', ['scripts/persona-backup.ts', 'tests/sim/personas/religious_conservative.yaml', file]);

  await freshStart(page, '#/settings');
  await page.getByTestId('backup-file').setInputFiles(file);
  await page.getByTestId('restore-replace').click();
  await expect(page.getByText('Backup restored.')).toBeVisible();

  await page.getByTestId('nav-results').click();
  await expect(page.getByTestId('position-abortion')).toContainText("Illegal except to save the woman's life");
  await expect(page.getByTestId('axis-cultural-position')).toContainText('Tradition');
  // Bodily autonomy rated low on abortion and assisted dying but high on vaccines, and so on.
  await expect(page.getByTestId('tension-row')).toHaveCount(3);
});

test('deleting all data really empties the app', async ({ page }) => {
  await freshStart(page, '#/m/abortion');
  await page.getByTestId('scale-stance-4').click();
  await expect(page.getByTestId('q-importance')).toBeVisible();
  await page.goto('#/settings');
  await page.getByTestId('delete-all').click();
  await page.getByTestId('delete-confirm').click();
  await expect(page.getByText('All data deleted.')).toBeVisible();
  await page.reload();
  await page.getByTestId('nav-results').click();
  await expect(page.getByText('Answer a few topics and your results will appear here.')).toBeVisible();
});
