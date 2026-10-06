import test from 'node:test';
import assert from 'node:assert/strict';
import { ResendAdapter } from '../dist/index.js';
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });
test('Resend uses bearer authorization and provider idempotency header', async () => {
  let seen;
  globalThis.fetch = async (url, init) => { seen = { url: String(url), init }; return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 }); };
  const adapter = new ResendAdapter({ apiKey: 'resend-secret', defaultFrom: 'TwiPay <noreply@twipay.co>', baseUrl: 'https://resend.example' });
  const result = await adapter.send({ channel: 'EMAIL', destination: 'user@example.com', subject: 'Receipt', text: 'Paid', idempotencyKey: 'ntf_12345678' });
  assert.equal(seen.url, 'https://resend.example/emails');
  assert.equal(seen.init.headers.Authorization, 'Bearer resend-secret');
  assert.equal(seen.init.headers['Idempotency-Key'], 'ntf_12345678');
  assert.equal(result.status, 'ACCEPTED');
});
