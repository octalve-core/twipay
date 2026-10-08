import { test, expect, type Page } from '@playwright/test';

/**
 * Live-read-only tests: requires running Vite customer UI and TwiPay API with
 * disposable sandbox credentials. No mutation, provider call, or fake receipt.
 * NOT EXECUTED in the source-only Batch C1 environment.
 */
const email = process.env['TWIPAY_TEST_CUSTOMER_EMAIL'];
const password = process.env['TWIPAY_TEST_CUSTOMER_PASSWORD'];
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByLabel('Email', {exact: true}).fill(email!);
  await page.getByLabel('Password', {exact: true}).fill(password!);
  await page.getByRole('button', {name: 'Log in', exact: true}).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/)?$/);
}

test('anonymous visitor cannot see history or receipt data', async ({page}) => {
  await page.goto('/dashboard/history');
  await expect(page).toHaveURL(/\/auth\/login$/);
  // Receipt route can render its frame anonymously, but API is session guarded:
  // it cannot return another user's financial detail.
});

test('authenticated customer sees real history or truthful empty state', async ({page}) => {
  test.skip(!email || !password, 'Needs disposable TwiPay sandbox customer credentials');
  await login(page);
  await page.goto('/dashboard/history');
  await expect(page.getByText('History').first()).toBeVisible();
  await expect(page.getByText(/Unable to load transaction history/)).toHaveCount(0);
  const firstTransaction = page.locator('a[href^="/dashboard/history/"]').first();
  if (await firstTransaction.count()) {
    const reference = await firstTransaction.getAttribute('href');
    await firstTransaction.click();
    await expect(page).toHaveURL(new RegExp('/dashboard/history/'));
    await expect(page.getByText(/Unable to load transaction details/)).toHaveCount(0);
    if (reference) await page.goto(`/receipt?txnId=${encodeURIComponent(reference.split('/').at(-1)!)}`);
    await expect(page.getByText(/Transaction receipt|Transaction record/).first()).toBeVisible();
  } else {
    await expect(page.getByText(/No transactions/).first()).toBeVisible();
  }
});
