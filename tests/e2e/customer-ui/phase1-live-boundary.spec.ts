import { test, expect } from '@playwright/test';

const api = (process.env['API_URL'] ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const origin = process.env['APP_URL'] ?? 'http://127.0.0.1:3000';

test('production-build customer HTML is the ErhaPay-derived React shell, never the retired Next app', async ({ page }) => {
  const response = await page.goto('/auth/login');
  expect(response?.status()).toBe(200);
  expect(await page.title()).toBe('TwiPay');
  expect(await page.locator('#root').count()).toBe(1);
  expect(await page.locator('#__next').count()).toBe(0);
  await expect(page.getByLabel('Email', {exact: true})).toBeVisible();
  await expect(page.getByLabel('Password', {exact: true})).toBeVisible();
});

test('unauthenticated wallet access and money mutations are refused without contacting providers', async ({request}) => {
  const wallet = await request.get(`${api}/v1/wallets`);
  expect(wallet.status()).toBe(401);
  const transfer = await request.post(`${api}/v1/transfers`, {
    headers: {origin, 'content-type': 'application/json'},
    data: {amountMinor: '100', bankCode: '000', accountNumber: '0000000000'},
  });
  expect(transfer.status()).toBe(401);
  const collection = await request.post(`${api}/v1/payments/collections`, {
    headers: {origin, 'content-type': 'application/json'},
    data: {amountMinor: '100'},
  });
  expect(collection.status()).toBe(401);
});

test('unknown browser origins do not bypass API CSRF/origin protection', async ({ request }) => {
  const response = await request.post(`${api}/v1/transfers`, {
    headers: {origin: 'https://malicious.example', 'content-type': 'application/json'},
    data: {amountMinor: '100'},
  });
  expect(response.status()).toBe(403);
});