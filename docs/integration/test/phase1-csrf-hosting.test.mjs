import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHmac} from 'node:crypto';
import {deriveSessionCsrfToken} from '../../../apps/api/src/modules/auth/application/session-csrf.ts';
import {validateCustomerHosting} from '../../../scripts/qualification/check-customer-hosting.mjs';
const root=resolve(import.meta.dirname,'../../..');
const read = path => readFileSync(join(root,path),'utf8');
const config=JSON.parse(read('apps/customer-ui/vercel.json'));
const env = () => ({
  TWIPAY_APPROVED_SITE_HOST:'twipay.example',
  APP_URL:'https://app.twipay.example',
  ADMIN_URL:'https://admin.twipay.example',
  VITE_TWIPAY_API_URL:'https://api.twipay.example',
  VITE_TWIPAY_FUNDING_SANDBOX_ENABLED:'false',
  VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED:'false',
  VITE_TWIPAY_VIRTUAL_ACCOUNT_SANDBOX_ENABLED:'false',
  VITE_TWIPAY_BILLS_SANDBOX_ENABLED:'false',
  VITE_TWIPAY_EVENT_CHECKOUT_SANDBOX_ENABLED:'false',
});
const pepper='test-only-csrf-pepper-long-enough-0123456789';
test('CSRF token is stable for parallel mutations of one active session',()=>{
  const a=deriveSessionCsrfToken('session-token-1',pepper);
  assert.equal(a,deriveSessionCsrfToken('session-token-1',pepper));
  assert.equal(Buffer.from(a,'base64url').length,32);
  assert.notEqual(a,deriveSessionCsrfToken('session-token-2',pepper));
  assert.notEqual(a,deriveSessionCsrfToken('session-token-1',pepper+'2'));
});
test('CSRF helper rejects missing or weak session secrets',()=>{
  assert.throws(()=>deriveSessionCsrfToken('session','tiny'),/SECRET_UNAVAILABLE/);
  assert.throws(()=>deriveSessionCsrfToken('',pepper),/SECRET_UNAVAILABLE/);
});
test('backend issues session-bound CSRF without rotating DB hash per request',()=>{
  const service=read('apps/api/src/modules/auth/application/session.service.ts');
  const start=service.indexOf('async issueCsrf('),end=service.indexOf('async rotate(',start);
  assert.ok(start>0 && end>start);
  const block=service.slice(start,end);
  assert.match(block,/deriveSessionCsrfToken\(token, this\.pepper\(\)\)/);
  assert.match(block,/if \(safeEqualHex\(expectedHash, session\.csrfTokenHash\)\) return csrfToken/);
  assert.match(block,/csrfTokenHash: session\.csrfTokenHash/);
  assert.match(block,/status: 'ACTIVE'/);
  assert.match(block,/expiresAt: \{ gt: now \}/);
  assert.match(block,/const latest = await this\.resolve\(token\)/);
  assert.doesNotMatch(block,/randomBytes/);
  assert.match(read('apps/api/src/modules/auth/presentation/auth.controller.ts'),/this\.sessions\.issueCsrf\(token\)/);
});
test('origin, cookie and server-side CSRF hash must all pass for mutations',()=>{
  const guard=read('apps/api/src/modules/auth/presentation/request-security.guard.ts');
  assert.match(guard,/ORIGIN_NOT_ALLOWED/);
  assert.match(guard,/csrfCookie !== csrfHeader/);
  assert.match(guard,/this\.sessions\.verifyCsrf\(session\.id, csrfHeader\)/);
  assert.match(read('apps/api/src/modules/auth/presentation/session-cookie.ts'),/sameSite: 'strict'/);
});
test('hosting policy accepts approved secure same-site, separate customer/admin/API hosts',()=>{
  assert.equal(validateCustomerHosting(env(),config).productionFinancialFlags,'disabled');
});
test('hosting rejects third-party preview domain with strict cookie model',()=>{
  assert.throws(()=>validateCustomerHosting({...env(),APP_URL:'https://twipay.vercel.app'},config),/CROSS_SITE/);
});
test('hosting rejects unsecured URLs, credentials, nonstandard ports or path origins',()=>{
  for (const url of ['http://app.twipay.example','https://user:pass@app.twipay.example','https://app.twipay.example:443/path','https://app.twipay.example:8443']) {
    assert.throws(()=>validateCustomerHosting({...env(),APP_URL:url},config),/MUST_BE_ABSOLUTE_HTTPS_ORIGIN/);
  }
});
test('hosting refuses production money flags even if frontend toggled only',()=>{
  for (const key of ['VITE_TWIPAY_FUNDING_SANDBOX_ENABLED','VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED','VITE_TWIPAY_EVENT_CHECKOUT_SANDBOX_ENABLED']) {
    assert.throws(()=>validateCustomerHosting({...env(),[key]:'true'},config),/PRODUCTION_FLAG_NOT_DISABLED/);
  }
});
test('hosting rejects bundling credentials in VITE_ variables',()=>{
  assert.throws(()=>validateCustomerHosting({...env(),VITE_PAYSTACK_SECRET_KEY:'do-not-ship'},config),/CREDENTIALS/);
});
test('hosting rejects missing SPA deep links and missing defensive headers',()=>{
  assert.throws(()=>validateCustomerHosting(env(),{rewrites:[],headers:config.headers}),/SPA_DEEP_LINK/);
  assert.throws(()=>validateCustomerHosting(env(),{rewrites:config.rewrites,headers:[]}),/HOSTING_HEADER_MISSING/);
});
test('sensitive ticket, financial and identity API responses remain uncached',()=>{
  assert.match(read('apps/api/src/main.ts'),/reply\.header\('Cache-Control', 'no-store'\)/);
});
