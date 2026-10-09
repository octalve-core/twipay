import {test, expect, type Page} from '@playwright/test';

const email = process.env['TWIPAY_TEST_CUSTOMER_EMAIL'];
const password = process.env['TWIPAY_TEST_CUSTOMER_PASSWORD'];
const mfaEmail = process.env['TWIPAY_TEST_MFA_EMAIL'];
const mfaPassword = process.env['TWIPAY_TEST_MFA_PASSWORD'];
const mfaCode = process.env['TWIPAY_TEST_MFA_CODE'];

async function login(page: Page, username: string, secret: string) {
  await page.goto('/auth/login');
  await page.getByLabel('Email', {exact:true}).fill(username);
  await page.getByLabel('Password', {exact:true}).fill(secret);
  await page.getByRole('button', {name:'Log in', exact:true}).click();
}

test('anonymous customer cannot enter protected settings', async ({page}) => {
  await page.goto('/dashboard/settings/account');
  await expect(page).toHaveURL(/\/auth\/login$/);
});

test('customer session, preserved account form and read-only KYC status', async ({page}) => {
  test.skip(!email || !password, 'Requires disposable sandbox TWIPAY_TEST_CUSTOMER_EMAIL/PASSWORD');
  await login(page, email!, password!);
  await expect(page).toHaveURL(/\/dashboard(?:\/)?$/);
  await page.goto('/dashboard/settings/account');
  await expect(page.getByRole('heading', {name: 'Account'})).toBeVisible();
  await expect(page.locator('#email')).toHaveValue(email!);
  await expect(page.locator('#firstname')).toBeEditable();
  await expect(page.locator('#lastname')).toBeEditable();
  await expect(page.locator('#country')).toBeEditable();
  await expect(page.locator('#state')).toBeEditable();
  await expect(page.locator('#email')).toBeDisabled();
  await expect(page.getByRole('button', {name:'Change Photo'})).toBeDisabled();
  await page.goto('/dashboard/settings/identity-verification');
  await expect(page.getByRole('heading', {name:'Identity verification'})).toBeVisible();
  await expect(page.getByLabel('Identity verification history')).toBeVisible();
  await expect(page.getByRole('button', {name:'Verify identity'})).toBeDisabled();
});

test('MFA-enabled customer must satisfy step-up before customer dashboard', async ({page}) => {
  test.skip(!mfaEmail || !mfaPassword || !mfaCode, 'Requires separate sandbox MFA account and current one-time code');
  await login(page, mfaEmail!, mfaPassword!);
  await expect(page).toHaveURL(/\/auth\/two-factor-authentication$/);
  await page.getByRole('textbox').first().fill(mfaCode!);
  await page.getByRole('button', {name:'Verify and continue'}).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/)?$/);
});

test('invalid KYC data and absent consent do not submit verification', async ({page}) => {
  test.skip(!email || !password, 'Requires disposable sandbox customer account');
  await login(page, email!, password!);
  await page.goto('/dashboard/settings/identity-verification');
  const button = page.getByRole('button', {name:'Verify identity'});
  await expect(button).toBeDisabled();
  await page.getByLabel('11-digit BVN').fill('123');
  await page.getByRole('checkbox').check();
  await expect(button).toBeDisabled();
  await page.getByLabel('11-digit BVN').fill('12345678901');
  await expect(button).toBeEnabled();
  await page.getByRole('checkbox').uncheck();
  await expect(button).toBeDisabled();
  // Deliberately DO NOT submit an identity number or invoke a chargeable provider.
});
