import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the production build (`vite preview`), so the CSP and the
// service worker are exercised exactly as deployed.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4173/Who-Am-I-/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173/Who-Am-I-/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
