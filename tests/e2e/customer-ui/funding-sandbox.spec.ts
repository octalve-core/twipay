import { test, expect, type Page } from '@playwright/test';

/**
 * Batch C2 browser gate. Do not run a real funding initialization in production.
 * Sandbox mutating scenario requires explicit opt-in and a disposable test user.
 * Payment provider settlement must be tested separately with webhook/requery/ledger evidence.
 */
const email = process.env['TWIPAY_TEST_CUSTOMER_EMAIL'];
const password = process.env['TWIPAY_TEST_CUSTOMER_PASSWORD'];
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/)?$/);
}

test('provider return alone never asserts successful funding', async ({page}) => {
  await page.goto('/wallet/fund/complete?status=SUCCESSFUL&reference=unverified');
  await expect(page.getByText(/does not confirm payment/i)).toBeVisible();
  await expect(page.getByRole('link', {name:'View transaction history'})).toBeVisible();
});

test('unqualified customer funding refuses submissions by default', async ({page}) => {
  test.skip(!email || !password, 'Requires isolated test customer');
  test.skip(process.env['VITE_TWIPAY_FUNDING_SANDBOX_ENABLED'] === 'true', 'Run disabled-gate test with UI sandbox flag false');
  await login(page);
  await page.goto('/dashboard/add-funds');
  await page.getByLabel('Amount to fund').fill('100.25');
  await page.getByRole('button', {name:/Proceed.*Payment method/i}).click();
  await expect(page.getByText(/Adding money is temporarily unavailable/)).toBeVisible();
  await expect(page.getByRole('button', {name:/Proceed.*Payment/i})).toBeDisabled();
});

test('isolated sandbox purchase confirmation requires PIN before initialization', async ({page}) => {
  test.skip(!email || !password || process.env['TWIPAY_ALLOW_SANDBOX_COLLECTION_E2E'] !== 'true',
    'Requires explicit isolated nonproduction provider test consent and test credentials');
  await login(page);
  await page.goto('/dashboard/add-funds');
  await page.getByLabel('Amount to fund').fill('100.25');
  await page.getByRole('button', {name:/Proceed.*Payment method/i}).click();
  await page.getByRole('button', {name:'Paystack'}).click();
  await expect(page.getByLabel('Transaction PIN')).toBeVisible();
  // Do not send a funding request without a real disposable PIN and authorized provider fixture.
  await expect(page.getByRole('button', {name:/Proceed.*Payment/i})).toBeDisabled();
  await expect(page.getByText(/Initializing a payment does not credit your wallet/)).toBeVisible();
  // Never click the real checkout button or assert that the provider settled funds.
});
