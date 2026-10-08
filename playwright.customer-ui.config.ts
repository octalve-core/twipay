import { defineConfig, devices } from '@playwright/test';

// Runs ONLY against a deliberately configured, reachable, nonproduction TwiPay
// customer UI + API. Does not start services or seed financial accounts.
export default defineConfig({
  testDir: './tests/e2e/customer-ui',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env['TWIPAY_CUSTOMER_UI_URL'] || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
