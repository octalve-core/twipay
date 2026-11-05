import { expect, type Page } from '@playwright/test';
import { freshCode } from './authenticator.js';
import { typeLikeAPerson } from './human.js';
import { clearAndType } from './ui.js';
import { authBudget } from './pace.js';
import { firstLoad } from './nav.js';
import { observe, type Observation } from './observers.js';
import type { Person, World } from './world.js';

export const navLink = (page: Page, name: string) => page.getByRole('link', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first();

export async function adminSignIn(page: Page, who: Person): Promise<void> {
  await clearAndType(page.locator('input[name=email]'), who.email);
  await clearAndType(page.locator('input[name=password]'), who.password);
  await authBudget(page);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function adminSignOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: '↪' }).click();
  await expect(page).toHaveURL(/\/login/);
}

// MFA enrolment on the admin Security page, with the simulated authenticator app reading the secret the screen shows.
export async function enrolMfa(page: Page, who: Person): Promise<string> {
  await navLink(page, 'Security & MFA').click();
  await typeLikeAPerson(page.locator('input[name=password]'), who.password);
  await page.getByRole('button', { name: /Start Factor Enrollment/ }).click();
  await expect(page.getByText('Manual Setup Secret Key')).toBeVisible();
  const shown = await page.locator('main').innerText();
  const secret = shown.match(/\b[A-Z2-7]{16,}\b/)?.[0];
  expect(secret, 'the enrolment screen shows a secret').toBeTruthy();
  await typeLikeAPerson(page.locator('input[name=code]').first(), await freshCode(page, secret!));
  await page.getByRole('button', { name: /Confirm & Activate MFA Factor/ }).click();
  await expect(page.getByRole('button', { name: 'Step up this session' })).toBeVisible();
  return secret!;
}

// Owner actions need a recent MFA code: type a fresh one into "Step up this session".
export async function stepUp(page: Page, secret: string): Promise<void> {
  await navLink(page, 'Security & MFA').click();
  await typeLikeAPerson(page.locator('input[name=code]').first(), await freshCode(page, secret));
  await page.getByRole('button', { name: 'Step up this session' }).click();
}

// The approval dialog asks for six single-digit boxes; the first box takes focus and each digit moves on to the next.
export async function typeDialogCode(page: Page, secret: string): Promise<void> {
  await page.locator('#totp-box-0').click();
  await page.keyboard.type(await freshCode(page, secret), { delay: 90 });
}

// The admin console is its own tab (a different origin that no link joins to the customer app): open it once, on its sign-in page.
export async function openAdminTab(w: World): Promise<Page> {
  if (w.pages.admin) return w.pages.admin;
  w.pages.admin = await w.context.newPage();
  w.opened['admin'] = Date.now();
  observe(w.pages.admin, w.startedAt, w.observations as Observation[]);
  await firstLoad(w.pages.admin, `${w.admin}/login`);
  return w.pages.admin;
}
