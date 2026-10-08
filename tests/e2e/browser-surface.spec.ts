import { test, expect } from '@playwright/test';

const adminOrigin = (process.env['ADMIN_URL'] ?? 'http://127.0.0.1:3001').replace(/\/$/, '');

// Browser-only smoke: no test money, privileged credentials or provider calls.
test('customer registration and login pages expose accessible credential fields', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  await page.goto('/login');
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});

test('customer routes serve real UI shells without client-side authentication tokens', async ({ page }) => {
  for (const route of ['/dashboard', '/wallet', '/services', '/events', '/tickets', '/organizer', '/profile', '/support']) {
    const response = await page.goto(route);
    expect(response?.status(), `${route} should exist`).toBe(200);
    await expect(page.locator('body')).not.toBeEmpty();
    const keys = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
    expect(keys.filter((key) => /token|jwt|session|refresh/i.test(key))).toEqual([]);
  }
});

test('operations login and restricted views exist with strict CSP', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const route of ['/login', '/', '/providers', '/refunds', '/payouts', '/compliance', '/reports', '/audit', '/config', '/security']) {
    const response = await page.goto(`${adminOrigin}${route}`);
    expect(response?.status(), `${route} must not be missing`).toBe(200);
    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-eval');
  }
  await context.close();
});
