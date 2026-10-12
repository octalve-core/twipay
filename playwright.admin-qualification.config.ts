import { defineConfig, devices } from '@playwright/test';

/** Run only on a disposable, seeded, nonproduction stack with two distinct verified owners.
 * This is deliberately separate from the customer E2E suite: missing credentials must fail,
 * not silently skip required administrator authorization coverage.
 */
export default defineConfig({
  testDir: './tests/e2e/administrator',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: 'list',
  use: {
    baseURL: process.env['TWIPAY_ADMIN_URL'] || 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
