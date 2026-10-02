// Every e2e test fails on page errors, console errors (CSP violations are logged as errors), or
// any request to another origin: "nothing leaves your device" is checked, not assumed.
import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page, baseURL }, use) => {
      const origin = new URL(baseURL!).origin;
      const problems: string[] = [];
      page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
      });
      page.on('request', (r) => {
        const url = r.url();
        if (!url.startsWith(origin) && !url.startsWith('blob:') && !url.startsWith('data:')) problems.push(`external request: ${url}`);
      });
      await use();
      expect(problems, problems.join('\n')).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
