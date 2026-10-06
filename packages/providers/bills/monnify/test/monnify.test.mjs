import test from 'node:test';
import assert from 'node:assert/strict';
import { MonnifyBillsAdapter } from '../dist/index.js';

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });
function jsonResponse(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }); }

test('catalog follows auth -> billers -> biller-products using bearer token', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/api/v1/auth/login')) return jsonResponse({ requestSuccessful: true, responseBody: { accessToken: 'access', expiresIn: 3600 } });
    if (String(url).includes('/billers?')) return jsonResponse({ requestSuccessful: true, responseBody: { content: [{ billerCode: 'MTN', billerName: 'MTN' }] } });
    if (String(url).includes('/biller-products?')) return jsonResponse({ requestSuccessful: true, responseBody: { content: [{ productCode: 'MTN-1GB', productName: 'MTN 1GB', amount: 1000 }] } });
    throw new Error(`unexpected ${url}`);
  };
  const adapter = new MonnifyBillsAdapter({ apiKey: 'api', secretKey: 'secret', baseUrl: 'https://sandbox.example' });
  const products = await adapter.listProducts({ category: 'DATA' });
  assert.equal(products.length, 1);
  assert.equal(products[0].providerProductCode, 'MTN-1GB');
  assert.match(calls[1].url, /\/api\/v1\/vas\/bills-payment\/billers\?/);
  assert.match(calls[2].url, /\/api\/v1\/vas\/bills-payment\/biller-products\?/);
  assert.equal(calls[1].init.headers.Authorization, 'Bearer access');
});

test('vend uses TwiPay reference and normalizes exact amount/currency evidence', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/api/v1/auth/login')) return jsonResponse({ requestSuccessful: true, responseBody: { accessToken: 'access', expiresIn: 3600 } });
    return jsonResponse({ requestSuccessful: true, responseBody: { vendReference: 'bill_abc', transactionReference: 'mon-1', vendStatus: 'SUCCESS', vendAmount: 2500 } });
  };
  const adapter = new MonnifyBillsAdapter({ apiKey: 'api', secretKey: 'secret', baseUrl: 'https://sandbox.example' });
  const result = await adapter.purchase({ reference: 'bill_abc', providerRequestReference: 'bill_abc', category: 'DATA', providerProductCode: 'P1', providerBillerCode: 'B1', customerIdentifier: '08030000000', amountMinor: 250000n, currency: 'NGN' });
  const vend = JSON.parse(calls[1].init.body);
  assert.equal(vend.vendReference, 'bill_abc');
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.amountMinor, 250000n);
  assert.equal(result.currency, 'NGN');
});
