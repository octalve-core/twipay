/**
 * Executes actual ResendAdapter through loopback HTTP (NO Resend sandbox or real email).
 * Validates transport/request framing and conservative outcome classification.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(resolve(import.meta.dirname, '../../../packages/providers/email/resend/src/index.ts'), 'utf8');
const output = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
const moduleObject = {exports: {}};
new Function('require','module','exports',output)((name) => { throw new Error(`Unexpected runtime dependency: ${name}`); }, moduleObject, moduleObject.exports);
const { ResendAdapter } = moduleObject.exports;

async function fixture(t, status, body, contentType = 'application/json') {
  let lastRequest;
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    lastRequest = { method: req.method, url: req.url, headers: req.headers, json: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
    res.writeHead(status, { 'content-type': contentType });
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const adapter = new ResendAdapter({ apiKey: 'LOCAL-TEST-KEY', defaultFrom: 'Test <test@twipay.invalid>', baseUrl: `http://127.0.0.1:${port}` });
  const send = () => adapter.send({ channel: 'EMAIL', destination: 'test@twipay.invalid', subject: 'Verify email', text: 'Example code is 123456', idempotencyKey: 'local-challenge-1' });
  return { send, getRequest: () => lastRequest };
}
test('adapter sends authenticated idempotent HTTP request but reports acceptance only', async t => {
  const local = await fixture(t, 200, JSON.stringify({id:'test-provider-id'}));
  const result = await local.send();
  assert.equal(result.status, 'ACCEPTED');
  assert.equal(result.providerReference, 'test-provider-id');
  const req = local.getRequest();
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/emails');
  assert.equal(req.headers['idempotency-key'], 'local-challenge-1');
  assert.equal(req.headers.authorization, 'Bearer LOCAL-TEST-KEY');
  assert.deepEqual(req.json.to, ['test@twipay.invalid']);
});
test('explicit non-JSON 422 provider rejection is FAILED, not ambiguous transport failure', async t => {
  const local = await fixture(t, 422, '<html>rejected</html>', 'text/html');
  const result = await local.send();
  assert.equal(result.status, 'FAILED');
  assert.equal(result.rawStatus, 'HTTP_422');
});
test('HTTP 200 with invalid body has UNKNOWN outcome, never falsely delivered', async t => {
  const local = await fixture(t, 200, 'not-json', 'text/plain');
  const result = await local.send();
  assert.equal(result.status, 'UNKNOWN');
});
test('HTTP 200 without provider ID remains UNKNOWN, not delivered', async t => {
  const local = await fixture(t, 200, JSON.stringify({message:'queued'}));
  const result = await local.send();
  assert.equal(result.status, 'UNKNOWN');
});
