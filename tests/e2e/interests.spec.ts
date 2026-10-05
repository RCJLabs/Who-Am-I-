// What you enjoy: picks grouped by topic, the topics that matter most first, taste spectrums that
// can say "Mixed", and an overview line built only from answers that could be shared.
import { expect, test } from './fixtures.ts';

test('the Taste page groups what you enjoy by topic, and the overview names favorites from what could be shared', async ({ page }) => {
  // Music matters most: seven kinds, Jazz rated top. Its devotional question is answered too; it's
  // private, so it must never appear among the picks or on the overview.
  await page.goto('#/m/music');
  await page.getByTestId('scale-matters-5').click();
  for (const g of ['pop', 'hiphop', 'rock', 'rnb', 'electronic', 'latin', 'jazz']) await page.getByTestId(`opt-genres-${g}`).click();
  await page.getByRole('group', { name: 'Jazz' }).getByRole('button', { name: '5 of 5' }).click();
  await page.getByTestId('next-genres').click();
  // Devotional music is asked privately: "Prefer not to say", and the private note.
  await expect(page.getByTestId('declined-devotional')).toBeVisible();
  await expect(page.getByTestId('q-devotional')).toContainText('Private: never in your summary, cards or suggestions');
  await page.getByTestId('scale-devotional-5').click();
  await page.getByTestId('scale-discovery-1').click();
  await expect(page.getByTestId('q-taste')).toBeVisible();
  await page.getByTestId('flow-exit').click();

  // Food matters a little: one pick, and something new to eat.
  await page.goto('#/m/food');
  await page.getByTestId('scale-matters-2').click();
  await page.getByTestId('opt-kinds-korean').click();
  await page.getByTestId('next-kinds').click();
  await page.getByTestId('scale-try_new-5').click();
  await expect(page.getByTestId('q-spice')).toBeVisible();
  await page.getByTestId('flow-exit').click();

  // The overview: a favorite from each of the two topics that matter most.
  await page.goto('#/results');
  await expect(page.getByTestId('area-taste')).toContainText('Favorites: Jazz · Korean food');
  await expect(page.getByTestId('results-summary')).not.toContainText(/devotional|hymn/i);

  // The Taste page: Music first, then Food, each with how much it matters in words.
  await page.getByTestId('area-taste').click();
  const groups = page.locator('[data-testid^="interest-group-"]');
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0)).toHaveAttribute('data-testid', 'interest-group-music');
  await expect(groups.nth(0)).toContainText("Music · It's part of who I am");
  await expect(groups.nth(1)).toContainText('Food · A little');
  await expect(groups.nth(1)).toContainText('Korean food');

  // The five strongest, ties in the order the options are listed, then the rest on request.
  const music = page.getByTestId('interest-group-music').locator('.chip.enjoy');
  await expect(music).toHaveText(['Jazz', 'Pop', 'Hip-hop / rap', 'Rock', 'R&B / soul']);
  await page.getByTestId('interest-more-music').click();
  await expect(music).toHaveCount(7);
  await expect(page.getByTestId('interest-more-music')).toHaveCount(0);

  // Familiar in music, new in food: the spectrum says so, and the read-out says which way each pulls.
  await expect(page.getByTestId('axis-novelty')).toContainText('Mixed: your answers pull both ways');
  await expect(page.getByTestId('readout-taste')).toContainText('“Music” toward “Familiar”, and “Food” toward “New”');
  await expect(page.getByTestId('readout-taste')).toContainText('Your top picks: Jazz, Korean food and Pop.');
  await expect(page.getByTestId('section-taste')).not.toContainText(/devotional|hymn/i);
});
