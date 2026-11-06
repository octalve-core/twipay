import { expect, type Locator, type Page } from '@playwright/test';
import { authBudget } from './pace.js';
import { typeLikeAPerson } from './human.js';
import { readEmailedCode } from './inbox.js';
import type { Person } from './world.js';

export const link = (page: Page, name: string | RegExp) => page.getByRole('link', { name }).first();
export const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name }).first();

export async function clickLink(page: Page, name: string | RegExp): Promise<void> {
  await link(page, name).click();
}

export async function clearAndType(field: Locator, text: string): Promise<void> {
  await field.click();
  await field.press('Control+A');
  await field.press('Backspace');
  await typeLikeAPerson(field, text);
}

export async function expectHeading(page: Page, name: string | RegExp): Promise<void> {
  await expect(page.getByRole('heading', { name }).first()).toBeVisible();
}

// Registers through the sign-up form and confirms the emailed code, like a new customer would.
export async function signUpAndVerify(page: Page, who: Person): Promise<void> {
  await clickLink(page, 'Sign up');
  await typeLikeAPerson(page.locator('#firstname'), who.given);
  await typeLikeAPerson(page.locator('#lastname'), who.family);
  await typeLikeAPerson(page.locator('#email'), who.email);
  await typeLikeAPerson(page.locator('#password'), who.password);
  await authBudget(page);
  await button(page, 'Create account').click();
  await expect(page).toHaveURL(/\/auth\/verify-email/);
  const code = await readEmailedCode(page, who.email, 'Verify your TwiPay email');
  await typeLikeAPerson(page.locator('#email-otp'), code);
  await button(page, 'Verify and continue').click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function signInCustomer(page: Page, who: Person): Promise<void> {
  await typeLikeAPerson(page.locator('#email'), who.email);
  await typeLikeAPerson(page.locator('#password'), who.password);
  await authBudget(page);
  await button(page, 'Log in').click();
}
