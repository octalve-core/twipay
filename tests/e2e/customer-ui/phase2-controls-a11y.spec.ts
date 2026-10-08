import { test, expect } from '@playwright/test';
/** Read-only Phase 2.2 UI smoke; requires the actual built Vite customer app. */
test('login inputs announce errors and password toggle is keyboard-accessible', async ({page}) => {
  await page.goto('/auth/login');
  await expect(page.getByRole('textbox',{name:'Email'})).toBeVisible();
  const toggle=page.getByRole('button',{name:'Show password'});
  await expect(toggle).toBeVisible();
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Hide password'})).toBeVisible();
  await page.getByRole('button',{name:'Log in'}).click(); // INVALID empty form: no network mutation
  await expect(page.locator('#email[aria-invalid="true"]')).toBeVisible();
  await expect(page.locator('#email-error[role="alert"]')).toBeVisible();
});
test('sign-up errors associate with existing ErhaPay fields', async ({page}) => {
  await page.goto('/auth/signup');
  await page.getByRole('button',{name:'Create account'}).click(); // INVALID empty form only
  for (const id of ['firstname','lastname','email','password']) {
    await expect(page.locator(`#${id}[aria-invalid="true"]`)).toBeVisible();
    await expect(page.locator(`#${id}-error[role="alert"]`)).toBeVisible();
  }
});
test('mobile public navigation has labelled dialog and supports Escape', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'Open site menu'}).click();
  await expect(page.getByRole('dialog',{name:'Site menu'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog',{name:'Site menu'})).toBeHidden();
});
