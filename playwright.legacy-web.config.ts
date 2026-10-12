import { defineConfig, devices } from '@playwright/test';

/** Historical Next.js customer test suite; NOT a TwiPay customer release gate. */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/browser-surface.spec.ts', '**/release-security.spec.ts'],
  forbidOnly: true,
  workers: 1,
  use: { baseURL: process.env['LEGACY_WEB_URL'] ?? 'http://127.0.0.1:3010' },
  projects: [{ name: 'legacy-chromium', use: { ...devices['Desktop Chrome'] } }],
});