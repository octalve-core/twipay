import type { Page } from '@playwright/test';

// Sign-in and registration share one limit of 10 requests per minute per IP. This keeps the journey under it by waiting,
// unconditionally, so the wait never depends on what the app shows. Call before every submit that hits /auth/login or /auth/register.
const recent: number[] = [];

export async function authBudget(page: Page, perMinute = 8): Promise<void> {
  const now = Date.now();
  while (recent.length && now - recent[0]! > 60_000) recent.shift();
  if (recent.length >= perMinute) await page.waitForTimeout(60_000 - (now - recent[0]!) + 500);
  recent.push(Date.now());
}
