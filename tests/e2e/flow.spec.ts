import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures.ts';
import { answerFlow, freshStart } from './helpers.ts';

test('a challenge can move you, the other side then challenges you, and results remember it', async ({ page }) => {
  await freshStart(page, '#/m/abortion');

  const { seen, end } = await answerFlow(page, {
    'abortion.stance': 2, // Illegal except to save the woman's life
    'abortion.ch_violinist': 'rethink',
    'abortion.stance@reask': [5], // Legal early in pregnancy, restricted later
    'abortion.ch_future': 'body',
  });
  expect(end).toBe('done');

  // The violinist is aimed at the restrictive answer; reconsidering re-asks the stance at once.
  const violinist = seen.indexOf('abortion.ch_violinist');
  expect(violinist).toBeGreaterThan(-1);
  expect(seen[violinist + 1]).toBe('abortion.stance@reask');
  // After moving to the permissive side, that side gets challenged too.
  expect(seen.slice(violinist)).toContain('abortion.ch_future');
  // The final "where do you land now?" runs after the new challenge.
  expect(seen.at(-1)).toBe('abortion.stance@reask');

  await expect(page.getByTestId('landed')).toHaveText('Legal early in pregnancy, restricted later');
  await expect(page.getByTestId('moved').first()).toContainText('The violinist');

  await page.getByTestId('see-results').click();
  await expect(page.getByTestId('position-abortion')).toContainText('Legal early in pregnancy, restricted later');
  await expect(page.getByTestId('moved-abortion').first()).toContainText('The violinist');

  // Answers survive a reload (IndexedDB).
  await page.reload();
  await expect(page.getByTestId('position-abortion')).toContainText('Legal early in pregnancy, restricted later');

  // And can be exported as a backup file.
  await page.getByTestId('nav-settings').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup-download').click()]);
  const backup = JSON.parse(readFileSync((await download.path())!, 'utf8')) as { format: string; events: { item: string }[] };
  expect(backup.format).toBe('whoami.backup');
  expect(backup.events.some((e) => e.item === 'abortion.ch_violinist')).toBe(true);
});

test('the personality short form shows an intro and produces Big Five results', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('start').click();
  await page.getByTestId('intro-start').click();
  const answers = Object.fromEntries(
    ['e', 'a', 'c', 'n', 'i'].flatMap((t) => [1, 2, 3, 4].map((n) => [`mini_ipip.${t}${n}`, n % 2 ? 5 : 2])),
  );
  const { seen, end } = await answerFlow(page, answers);
  expect(end).toBe('done');
  expect(seen).toHaveLength(20);
  await page.getByTestId('see-results').click();
  await expect(page.getByTestId('axis-extraversion-position')).toBeVisible();
});

test('this-or-that choices place you on the values spectrums', async ({ page }) => {
  await freshStart(page, '#/m/value_tradeoffs');
  await page.getByTestId('intro-start').click();
  const { seen, end } = await answerFlow(page, {
    'value_tradeoffs.freedom': 'choose',
    'value_tradeoffs.success': 'there',
    'value_tradeoffs.tradition': 'exciting',
    'value_tradeoffs.fair_world': 'fairer',
    'value_tradeoffs.own_way': 'my_way',
    'value_tradeoffs.career': 'nature',
    'value_tradeoffs.predictable': 'new_things',
    'value_tradeoffs.loyal': 'dependable',
    'value_tradeoffs.original': 'stand_out',
    'value_tradeoffs.admired': 'understanding',
  });
  expect(end).toBe('done');
  expect(seen).toHaveLength(10);
  await page.getByTestId('see-results').click();
  await expect(page.getByTestId('axis-change-position')).toHaveText('Strongly Change');
  await expect(page.getByTestId('axis-others-position')).toHaveText("Strongly Others' welfare");
});

test('answering anchors very differently across topics raises a tension card', async ({ page }) => {
  await freshStart(page, '#/m/abortion');
  await answerFlow(page, { 'abortion.anchor_ba': 7 });

  await page.goto('#/m/vaccine_mandates');
  const { end } = await answerFlow(page, { 'vaccine_mandates.anchor_ba': 1 });
  expect(end).toBe('tension');

  const card = page.getByTestId('tension');
  await expect(card).toContainText('Bodily autonomy');
  await expect(card).toContainText('the health of other people');
  await page.getByTestId('reason-harm_to_others').click();
  await expect(page.getByTestId('topic-done')).toBeVisible();

  await page.goto('#/results');
  await expect(page.getByTestId('tension-row')).toContainText('You named a difference');
});

test('every question can be skipped, and a skipped stance gets no challenges', async ({ page }) => {
  await freshStart(page, '#/m/assisted_dying');
  const { seen, end } = await answerFlow(page, {});
  expect(end).toBe('done');
  expect(seen.some((id) => id.includes('.ch_'))).toBe(false);
});
