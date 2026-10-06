import test from 'node:test';
import assert from 'node:assert/strict';
import { TermiiAdapter } from '../dist/index.js';
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });
test('Termii adapter is server-side SMS only and sends configured credential in provider payload', async () => {
  let seen;
  globalThis.fetch = async (url, init) => { seen = { url: String(url), init }; return new Response(JSON.stringify({ message_id: 'msg-1', message: 'Successfully Sent' }), { status: 200 }); };
  const adapter = new TermiiAdapter({ apiKey: 'secret-api', senderId: 'TwiPay', baseUrl: 'https://termii.example' });
  const result = await adapter.send({ channel: 'SMS', destination: '+2348030000000', text: 'Receipt ready', idempotencyKey: 'ntf_12345678' });
  const body = JSON.parse(seen.init.body);
  assert.equal(seen.url, 'https://termii.example/api/sms/send');
  assert.equal(body.api_key, 'secret-api');
  assert.equal(body.to, '2348030000000');
  assert.equal(result.status, 'ACCEPTED');
});
