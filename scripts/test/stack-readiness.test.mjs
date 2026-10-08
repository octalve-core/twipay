import test from 'node:test';
import assert from 'node:assert/strict';
import { isReadyStatus, waitForTarget } from '../stack-readiness.mjs';

test('4xx and 5xx responses do not qualify as a ready stack', () => {
  for (const status of [400, 401, 403, 404, 429, 500, 502, 503]) assert.equal(isReadyStatus(status), false);
  assert.equal(isReadyStatus(200), true);
  assert.equal(isReadyStatus(302), true);
});

test('a 404 health response fails readiness instead of being accepted', async () => {
  let clock = 0;
  await assert.rejects(() => waitForTarget('http://localhost/health', {
    fetcher: async () => ({ status: 404 }), timeoutMs: 2, intervalMs: 1,
    now: () => clock, sleep: async (ms) => { clock += ms; },
  }), /STACK_TARGET_UNAVAILABLE.*HTTP 404/);
});

test('a service that becomes ready after an error succeeds', async () => {
  let calls = 0;
  let clock = 0;
  await waitForTarget('http://localhost/health', {
    fetcher: async () => ({ status: ++calls === 1 ? 503 : 200 }), timeoutMs: 3,
    intervalMs: 1, now: () => clock, sleep: async (ms) => { clock += ms; },
  });
  assert.equal(calls, 2);
});
