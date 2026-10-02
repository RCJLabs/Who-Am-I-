import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    // Simulation suites run thousands of respondents; keep slow CI runners from timing out.
    testTimeout: 30_000,
  },
});
