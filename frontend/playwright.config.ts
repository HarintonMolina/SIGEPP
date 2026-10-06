import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: process.env.E2E_MODE === 'rate-limit' ? 'rate-limit.spec.ts'
    : process.env.E2E_ZOOM === '1' ? 'zoom.spec.ts'
    : ['auth.spec.ts', 'navigation.spec.ts', 'session.spec.ts', 'accessibility.spec.ts'],
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [['line']],
  use: { baseURL: 'http://localhost:5173', browserName: 'chromium', viewport: { width: 1280, height: 800 },
    trace: 'off', screenshot: 'off', video: 'off' },
  // Error snapshots can include typed credentials. Keep all persistence opt-in and sanitized.
  preserveOutput: 'never',
});
