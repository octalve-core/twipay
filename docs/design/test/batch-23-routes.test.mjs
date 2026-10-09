import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {isPathUnderAnyPrefix, normalizeRoutePath} from '../../../apps/customer-ui/src/lib/routePath.ts';
const root=resolve(import.meta.dirname,'../../..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const app=read('apps/customer-ui/src/App.tsx');
const constants=read('apps/customer-ui/src/lib/constants.ts');
const prefixes=['/dashboard/services/betting','/dashboard/services/epin','/dashboard/virtual-card','/dashboard/transfer-funds'];

test('canonical path matching rejects case/percent encoding bypass of excluded/deferred features',()=>{
  for(const path of ['/DASHBOARD/SERVICES/BETTING','/dashboard/services/%65pin','/dashboard/virtual-card/details', '/DASHBOARD/TRANSFER-FUNDS/']) {
    assert.equal(isPathUnderAnyPrefix(path,prefixes),true,path);
  }
  for (const path of ['/dashboard/history','/dashboard/services/airtime','/dashboard/events']) {
    assert.equal(isPathUnderAnyPrefix(path,prefixes),false,path);
  }
  assert.equal(normalizeRoutePath('/Dashboard/Services//AirTime/'),'/dashboard/services/airtime');
});
test('malformed and traversal-like path encodings fail closed',()=>{
  for(const path of ['/dashboard/%','/dashboard/%2fadmin','/dashboard/%5Cadmin','/dashboard/%2E%2E/other','/dashboard/%00route', '/dashboard/history?admin=true','https://external.test/dashboard']) {
    assert.equal(isPathUnderAnyPrefix(path,prefixes),true,path);
  }
});
test('real routes are preserved and future/internal-transfer links remain inactive',()=>{
  assert.match(app,/isDeferredOrExcludedRoute\(location\.pathname\)/);
  assert.match(constants,/removedProductRoutes = \["\/dashboard\/services\/betting"\]/);
  for(const path of ['/dashboard/transfer-funds','/dashboard/referral','/dashboard/virtual-card'])assert.ok(constants.includes(`"${path}"`));
  assert.match(constants,/activeQuickActions = quickActions\.filter/);
  assert.match(read('apps/customer-ui/src/components/dashboard/main-page/QuickActions.tsx'),/activeQuickActions\.map/);
  assert.match(app,/path: "transfer-funds"/); // preserved but guard-gated
  assert.match(app,/path: "events"/);
});
test('fake hardcoded success screen is unmounted but retained as historical source',()=>{
  assert.match(app,/path: "status",\s*\/\/[^\n]+\n\s*element: <Navigate to="\/dashboard\/history" replace \/>/);
  assert.doesNotMatch(app,/import Status from "\.\/routes\/dashboard\/Status"/);
  assert.match(read('apps/customer-ui/src/routes/dashboard/Status.tsx'),/isSuccessful = true/); // remains archived, not routed
});
test('standalone financial receipt now has the dashboard session and MFA requirements',()=>{
  assert.match(app,/element: <AuthenticatedCustomerRoute><ReceiptLayout \/><\/AuthenticatedCustomerRoute>/);
  const guard=read('apps/customer-ui/src/routes/layout/AuthenticatedCustomerRoute.tsx');
  for(const phrase of ['useAuth()','if (loading)','if (!user)','if (mfaRequired)','/auth/login','/auth/two-factor-authentication'])assert.ok(guard.includes(phrase),phrase);
  assert.match(read('apps/customer-ui/src/routes/layout/DashboardLayout.tsx'),/<AuthenticatedCustomerRoute>/);
  assert.doesNotMatch(guard,/localStorage|sessionStorage|VITE_TWIPAY_.*ENABLED|fetch\(/);
});
test('provider funding return remains informational and does not claim provider success',()=>{
  assert.match(app,/path: "\/wallet\/fund\/complete"/);
  const content=read('apps/customer-ui/src/routes/dashboard/FundingReturn.tsx');
  assert.match(content,/does not confirm your wallet has been funded/);
  assert.doesNotMatch(content,/payment status === ["']success/);
});
test('keyboard-operable sidebar separates navigation link from submenu toggle',()=>{
  const sidebar=read('apps/customer-ui/src/components/dashboard/sidebar/SidebarLinkWithSubCat.tsx');
  for(const fragment of ['aria-expanded={showSubCat}','aria-controls={menuId}','aria-current={selected','tabIndex={showSubCat ? undefined : -1}','onClick={closeSidebar}','focus-visible:outline-2']) assert.ok(sidebar.includes(fragment),fragment);
  assert.match(sidebar,/location\.pathname\.startsWith\(`\$\{link\}\/`\)/);
  assert.doesNotMatch(sidebar,/<Link[^>]+onClick=\{\(\) => \{\s*setShowSubCat\(prev => !prev\)/);
});
test('customer build, SPA entry and deployment identity stay ErhaPay/Vite-based',()=>{
  const pkg=JSON.parse(read('apps/customer-ui/package.json'));
  assert.equal(pkg.name,'@twipay/customer-ui');
  assert.match(pkg.scripts.build,/vite build/);
  const vercel=JSON.parse(read('apps/customer-ui/vercel.json'));
  assert.deepEqual(vercel.rewrites,[{source:'/(.*)',destination:'/index.html'}]);
  assert.match(read('apps/customer-ui/src/main.tsx'),/AuthContextProvider/);
  assert.match(read('apps/customer-ui/index.html'),/<title>TwiPay<\/title>/);
});
test('MFA challenge route cannot display without a pending authenticated challenge',()=>{
  assert.match(app,/element: <MfaChallengeRoute><TwoFAOtp \/><\/MfaChallengeRoute>/);
  const guard=read('apps/customer-ui/src/routes/layout/MfaChallengeRoute.tsx');
  assert.match(guard,/if \(!user\) return <Navigate to="\/auth\/login" replace \/>/);
  assert.match(guard,/if \(!mfaRequired\) return <Navigate to="\/dashboard" replace \/>/);
  for(const path of ['apps/customer-ui/src/routes/auth-pages/LogIn.tsx','apps/customer-ui/src/routes/auth-pages/SignUp.tsx']){
    const auth=read(path);
    assert.match(auth,/mfaRequired \? "\/auth\/two-factor-authentication" : "\/dashboard"/);
    assert.match(auth,/if \(loading\)/);
  }
});
