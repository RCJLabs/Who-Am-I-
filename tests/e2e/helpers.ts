import { expect, type Page } from '@playwright/test';

/**
 * Scripted answers for `answerFlow`:
 *   'topic.item': 3          scale step
 *   'topic.item': 'option'   option id (or 'skip' / 'unsure' / 'keep')
 *   'topic.item@reask': [5]  answers for successive re-asks of that item; afterwards: keep
 */
export type Script = Record<string, number | string | (number | string)[]>;

export type FlowEnd = 'done' | 'tension';

/** Answers questions until the topic is done or a tension card appears. Returns item ids seen. */
export async function answerFlow(page: Page, script: Script, max = 80): Promise<{ seen: string[]; end: FlowEnd }> {
  const seen: string[] = [];
  const reasks = new Map<string, number>();
  for (let i = 0; i < max; i++) {
    const question = page.locator('article.question');
    const done = page.getByTestId('topic-done');
    const tension = page.getByTestId('tension');
    await expect(question.or(done).or(tension)).toBeVisible();
    if (await done.isVisible()) return { seen, end: 'done' };
    if (await tension.isVisible()) return { seen, end: 'tension' };

    // Hold this exact element: a locator would re-resolve to the next question.
    const answered = await question.elementHandle();
    const itemId = (await question.getAttribute('data-item'))!;
    const key = itemId.split('.')[1]!;
    const isReask = (await page.getByTestId(`keep-${key}`).count()) > 0;
    seen.push(isReask ? `${itemId}@reask` : itemId);

    let answer: number | string;
    if (isReask) {
      const n = reasks.get(itemId) ?? 0;
      reasks.set(itemId, n + 1);
      const list = script[`${itemId}@reask`];
      const scripted = Array.isArray(list) ? list[n] : list;
      answer = scripted ?? 'keep';
    } else {
      const scripted = script[itemId];
      answer = (Array.isArray(scripted) ? scripted[0] : scripted) ?? 'skip';
    }

    if (typeof answer === 'number') await page.getByTestId(`scale-${key}-${answer}`).click();
    else if (answer === 'skip' || answer === 'unsure' || answer === 'keep') await page.getByTestId(`${answer}-${key}`).click();
    else await page.getByTestId(`opt-${key}-${answer}`).click();

    // Each question is keyed, so the answered one leaves the page before the next appears.
    if (answered) await page.waitForFunction((el) => !el.isConnected, answered);
  }
  throw new Error(`flow did not finish within ${max} steps`);
}

/** A fresh app with no stored answers. */
export async function freshStart(page: Page, hash = '#/'): Promise<void> {
  await page.goto(hash);
  await expect(page.locator('#app > :not(.splash)').first()).toBeVisible();
}
