import test from 'node:test';
import assert from 'node:assert/strict';
import { VtpassAdapter, vtpassRequestId } from '../dist/index.js';

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('request id starts with Africa/Lagos YYYYMMDDHHmm and is deterministic per reference', () => {
  const id = vtpassRequestId('bill_test_reference', new Date('2026-10-06T20:05:00Z'));
  assert.match(id, /^202610062105[a-f0-9]{20}$/);
  assert.equal(id, vtpassRequestId('bill_test_reference', new Date('2026-10-06T20:05:00Z')));
});

test('GET discovery uses public-key and never secret-key', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ content: [{ serviceID: 'mtn', name: 'MTN', minimum_amount: 50, maximum_amount: 50000 }] });
  };
  const adapter = new VtpassAdapter({ apiKey: 'api', publicKey: 'public', secretKey: 'secret', baseUrl: 'https://sandbox.example' });
  const products = await adapter.listProducts({ category: 'AIRTIME' });
  assert.equal(products.length, 1);
  assert.equal(calls[0].init.headers['api-key'], 'api');
  assert.equal(calls[0].init.headers['public-key'], 'public');
  assert.equal(calls[0].init.headers['secret-key'], undefined);
});

test('POST purchase uses secret-key, not public-key, and normalizes provider evidence', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ code: '000', amount: 1000, content: { transactions: { status: 'delivered', transactionId: 'vt-1', commission: 20 } } });
  };
  const adapter = new VtpassAdapter({ apiKey: 'api', publicKey: 'public', secretKey: 'secret', baseUrl: 'https://sandbox.example' });
  const result = await adapter.purchase({
    reference: 'bill_1234567890', providerRequestReference: '202610062105aaaaaaaaaaaaaaaaaaaa', category: 'AIRTIME', providerProductCode: 'mtn', providerBillerCode: 'mtn',
    customerIdentifier: '08030000000', amountMinor: 100000n, currency: 'NGN',
  });
  assert.equal(calls[0].init.headers['secret-key'], 'secret');
  assert.equal(calls[0].init.headers['public-key'], undefined);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.request_id, '202610062105aaaaaaaaaaaaaaaaaaaa');
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.amountMinor, 100000n);
  assert.equal(result.providerReference, 'vt-1');
});


test('ambiguous VTpass response codes never manufacture success', async () => {
  const replies = [
    { code: '000' },
    { code: '099' },
    { code: '016' },
    { code: '014' },
  ];
  const expected = ['UNKNOWN', 'PROCESSING', 'FAILED', 'UNKNOWN'];
  for (let i = 0; i < replies.length; i += 1) {
    globalThis.fetch = async () => jsonResponse(replies[i]);
    const adapter = new VtpassAdapter({ apiKey: 'api', publicKey: 'public', secretKey: 'secret', baseUrl: 'https://sandbox.example' });
    const result = await adapter.purchase({
      reference: `bill_status_${i}`, providerRequestReference: `202610062105${'b'.repeat(20)}`,
      category: 'AIRTIME', providerProductCode: 'mtn', providerBillerCode: 'mtn', customerIdentifier: '08030000000', amountMinor: 100000n, currency: 'NGN',
    });
    assert.equal(result.status, expected[i]);
  }
});
