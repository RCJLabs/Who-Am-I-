import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { parse } from 'yaml';

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
    else {
      const type = await question.getAttribute('data-type');
      await page.getByTestId(`opt-${key}-${answer}`).click();
      // This-or-that questions then ask "slightly or strongly"; scripts mean strongly.
      if (type === 'pair') await page.getByTestId(`strength-${key}-2`).click();
    }

    // Each question is keyed, so the answered one leaves the page before the next appears.
    if (answered) await page.waitForFunction((el) => !el.isConnected, answered);
  }
  throw new Error(`flow did not finish within ${max} steps`);
}

/** Opens one area's page of the results, through the overview's link to it. */
export async function openArea(page: Page, area: string): Promise<void> {
  await page.getByTestId('nav-results').click();
  await page.getByTestId(`area-${area}`).click();
  await expect(page.getByTestId(`section-${area}`)).toBeVisible();
}

/** A fresh app with no stored answers. */
export async function freshStart(page: Page, hash = '#/'): Promise<void> {
  await page.goto(hash);
  await expect(page.locator('#app > :not(.splash)').first()).toBeVisible();
}

/** Restores a persona's answers (a YAML file, see scripts/persona-backup.ts) and opens the results. */
export async function restorePersona(page: Page, persona: string): Promise<void> {
  const file = join(mkdtempSync(join(tmpdir(), 'whoami-')), 'backup.json');
  execFileSync('node', ['scripts/persona-backup.ts', persona, file]);
  await freshStart(page, '#/settings');
  await page.getByTestId('backup-file').setInputFiles(file);
  await page.getByTestId('restore-replace').click();
  await expect(page.getByText('Backup restored.')).toBeVisible();
  await page.getByTestId('nav-results').click();
}

/** Sensitive topics, by their own flag or their domain's, read from the content. */
export function sensitiveTopics(): Set<string> {
  const domains = new Set(
    (parse(readFileSync('content/domains.yaml', 'utf8')) as { id: string; sensitive?: boolean }[]).filter((d) => d.sensitive).map((d) => d.id),
  );
  return new Set(
    readdirSync('content/topics', { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => parse(readFileSync(join('content/topics', f), 'utf8')) as { id: string; domain: string; sensitive?: boolean })
      .filter((t) => t.sensitive || domains.has(t.domain))
      .map((t) => t.id),
  );
}
