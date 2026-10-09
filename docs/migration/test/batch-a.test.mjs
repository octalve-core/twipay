import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const app=join(root,'apps/customer-ui');
const original=JSON.parse(readFileSync(join(root,'docs/migration/BATCH_A_PRESERVATION_INVENTORY.json'),'utf8'));
const text=(path)=>readFileSync(join(app,path),'utf8');
const sha=(v)=>createHash('sha256').update(v).digest('hex');
const backend=(name)=>readFileSync(join(root,name),'utf8');

test('original asset contents remain intact, allowing only the repository-mandated SVG CRLF normalization',()=>{
 const assetFiles=original.files.filter(f=>f.path.startsWith('src/assets/') || f.path.startsWith('public/'));
 const approved=JSON.parse(readFileSync(join(root,'docs/design/ERHAPAY_ORIGINAL_VISUAL_ASSETS.json'),'utf8'));
 const svgByPath=new Map(approved.assets.filter(f=>f.kind==='svg').map(f=>[f.path,f]));
 assert.ok(assetFiles.length>100);
 for(const file of assetFiles) {
   const data=readFileSync(join(app,file.path));
   if(sha(data)===file.sha256) continue; // including ALL original binary/font assets
   const svg=svgByPath.get(file.path);
   assert.ok(svg, `only a manifest-pinned original SVG may be normalized: ${file.path}`);
   assert.equal(svg.originalSha256,file.sha256,`unaltered original SHA required: ${file.path}`);
   assert.equal(sha(Buffer.from(data.toString('utf8').replace(/\r\n/g,'\n'))),svg.normalizedSha256,`content changed: ${file.path}`);
 }
});
test('the original ErhaPay logo remains unchanged',()=>{
 const logo=original.files.find(f=>f.path==='src/assets/main-pages/logo.png');
 assert.ok(logo);assert.equal(sha(readFileSync(join(app,logo.path))),logo.sha256);
});
test('TwiPay rebranding and preserved route entry points',()=>{
 assert.match(text('index.html'),/<title>TwiPay<\/title>/);
 assert.match(text('src/App.tsx'),/path: "\/dashboard"/);
 assert.match(text('src/App.tsx'),/path: "events"/);
});
test('betting has no imported mounted route',()=>{
 assert.doesNotMatch(text('src/App.tsx'),/import Betting|<Betting\s*\/>|path:\s*["']services\/betting/);
 assert.match(text('src/lib/constants.ts'),/removedProductRoutes.*services\/betting/);
});
test('future modules preserved but filtered from navigation/direct route access',()=>{
 for(const file of ['src/components/dashboard/sidebar/DashboardLinks.tsx','src/components/dashboard/services/ServicesSection.tsx','src/components/dashboard/main-page/OtherServices.tsx']){
  assert.match(text(file),/active(?:DashboardLinks|AppServices|OtherServices)/);
 }
 assert.match(text('src/App.tsx'),/isDeferredOrExcludedRoute\(location\.pathname\)/);
 for(const f of ['src/components/dashboard/services/epin/Epin.tsx','src/components/dashboard/services/esim/ESim.tsx','src/routes/dashboard/Hotels.tsx']) assert.ok(existsSync(join(app,f)),f);
});
test('legacy bearer auth and BillPadi domain are absent from active Axios client',()=>{
 const s=text('src/lib/api/axios.ts');
 assert.doesNotMatch(s,/billpadi\.com|Authorization\s*=|localStorage/);
 assert.match(s,/withCredentials: true/);
 assert.match(s,/FEATURE_NOT_INTEGRATED/);
 assert.match(s,/x-csrf-token/);
});
test('auth endpoints mapped to actual TwiPay API controller',()=>{
 const s=text('src/lib/api/authApi.ts');
 const api=backend('apps/api/src/modules/auth/presentation/auth.controller.ts');
 for(const [frontend,controller] of [['/auth/register',"@Post('register')"],['/auth/login',"@Post('login')"],['/auth/logout',"@Post('logout')"],['/auth/me',"@Get('me')"],['/auth/csrf',"@Get('csrf')"]]){
  assert.ok(s.includes(frontend) || text("src/lib/api/axios.ts").includes(frontend),frontend);assert.ok(api.includes(controller),controller);
 }
 const mfa=backend('apps/api/src/modules/auth/presentation/mfa.controller.ts');
 assert.ok(s.includes('/auth/mfa/challenge')&&mfa.includes("@Post('challenge')"));
});
test('session authentication comes from the server, not persistent browser token storage',()=>{
 const s=text('src/context/AuthContext.tsx');
 assert.match(s,/getCurrentSession/);assert.match(s,/mfaRequired/);
 assert.doesNotMatch(s,/localStorage\.|sessionStorage\./);
 assert.match(text('src/routes/layout/DashboardLayout.tsx'),/AuthenticatedCustomerRoute/);
 const guard=text('src/routes/layout/AuthenticatedCustomerRoute.tsx');
 assert.match(guard,/mfaRequired/);
 assert.match(guard,/if \(!user\)/);
});
test('no active mock credit-card number or fake live balance',()=>{
 assert.doesNotMatch(text('src/components/dashboard/main-page/CreditCard.tsx'),/1234 1234|1,650,000/);
 assert.match(text('src/components/dashboard/main-page/BalanceCard.tsx'),/Balance temporarily unavailable/);
});
test('existing original TwiPay API and Next.js frontend remain present',()=>{
 assert.ok(existsSync(join(root,'apps/web/app/page.tsx')));
 assert.ok(existsSync(join(root,'apps/api/src/modules/auth/presentation/auth.controller.ts')));
});

// Batch B preparatory contract guards: these are static cross-layer assertions,
// NOT proof of live browser cookie/CSRF enforcement.
test('logout is a protected mutation and must obtain a real session CSRF token', () => {
 const client=text('src/lib/api/axios.ts');
 const guard=backend('apps/api/src/modules/auth/presentation/request-security.guard.ts');
 const controller=backend('apps/api/src/modules/auth/presentation/auth.controller.ts');
 const logout=backend('apps/customer-ui/src/lib/api/authApi.ts');
 assert.match(client,/!\["\/auth\/register", "\/auth\/login"\]\.includes\(config\.url/);
 assert.match(client,/config\.headers\.set\("x-csrf-token", body\.csrfToken\)/);
 assert.match(guard,/unauthenticatedBrowserMutations = new Set\(\['\/v1\/auth\/register', '\/v1\/auth\/login'\]\)/);
 assert.ok(!guard.includes("'/v1/auth/logout'") || !guard.match(/unauthenticatedBrowserMutations = new Set\([^)]*logout/));
 assert.match(controller, /@Post\('logout'\)/);
 assert.match(logout,/api\.post<\{ok: boolean\}>\("\/auth\/logout"\)/);
});

test('registration verifies server session before successful dashboard navigation', () => {
 const source=text('src/components/Authentication/SignUpForm.tsx');
 const scope=source.slice(source.indexOf('onSuccess: async () => {'), source.indexOf('onError:'));
 assert.ok(scope.indexOf('await refreshSession();') < scope.indexOf('navigate("/dashboard")'));
 assert.match(scope,/catch \{/);
 assert.match(scope,/navigate\("\/auth\/login"\)/);
});

// Batch B source-contract checks. These are NOT live PostgreSQL/browser security tests.
test('MFA enrollment/confirm/disable/recovery routes match NestJS controller', () => {
  const client = text('src/lib/api/authApi.ts');
  const apiClient = text('src/lib/api/axios.ts');
  const controller = backend('apps/api/src/modules/auth/presentation/mfa.controller.ts');
  for (const [clientPath, backendPath] of [
    ['/auth/mfa/enroll', "@Post('enroll')"],
    ['/auth/mfa/enroll/confirm', "@Post('enroll/confirm')"],
    ['/auth/mfa/recovery-codes/regenerate', "@Post('recovery-codes/regenerate')"],
    ['/auth/mfa/disable', "@Post('disable')"],
  ]) {
    assert.ok(client.includes(clientPath), clientPath);
    assert.ok(apiClient.includes(clientPath), `allowlist ${clientPath}`);
    assert.ok(controller.includes(backendPath), backendPath);
  }
});

test('ErhaPay 2FA modal now uses TwiPay authenticator and session rotation, not email OTP toggles', () => {
  const modal = text('src/components/dashboard/settings/set2FAModal.tsx');
  const form = text('src/components/dashboard/settings/Set2FAForm.tsx');
  assert.doesNotMatch(modal, /toggle2fa|send2faCode/);
  assert.doesNotMatch(form, /send2faCode|OTP has been sent to your mail/);
  for (const fn of ['beginMfaEnrollment','confirmMfaEnrollment','disableMfa','regenerateMfaRecoveryCodes','refreshSession']) {
    assert.ok(form.includes(fn), fn);
  }
  assert.match(form, /recoveryCodes\.map/);
  assert.doesNotMatch(form, /localStorage|sessionStorage|console\.log/);
});

test('MFA challenge screen supports backend one-time recovery codes and existing six-slot authenticator UI', () => {
  const page = text('src/routes/auth-pages/TwoFAOtp.tsx');
  const service = backend('apps/api/src/modules/auth/application/mfa.service.ts');
  assert.match(page, /useRecovery/);
  assert.match(page, /Use a recovery code/);
  assert.match(page, /InputOTPSlot/);
  assert.match(service, /normalizeRecoveryCode\(code\)/);
  assert.match(service, /method = 'RECOVERY'/);
});
