import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>readFileSync(p,'utf8');
const capture=read('scripts/design/capture-erhapay-public-reference.mjs');
const spec=read('tests/e2e/customer-ui/phase2-visual-a11y.spec.ts');

test('Visual reference requires two distinct loopback application servers',()=>{
  assert.match(capture,/ERHAPAY_REFERENCE_URL/);
  assert.match(capture,/TWIPAY_CUSTOMER_URL/);
  assert.match(capture,/hostname !== '127\.0\.0\.1'/);
  assert.match(capture,/original\.origin === current\.origin/);
  assert.match(capture,/url\.username \|\| url\.password/);
});
test('Visual capture blocks absent approved endpoints before importing Playwright',()=>{
  const r=(()=>{try{return execFileSync(process.execPath,['scripts/design/capture-erhapay-public-reference.mjs'],{encoding:'utf8',env:{PATH:process.env.PATH},stdio:'pipe'});}catch(e){assert.equal(e.status,1);return String(e.stderr);}})();
  assert.match(r,/BLOCKED: ERHAPAY_REFERENCE_URL/);
});
test('Visual captures may not leave their local origin or load service workers',()=>{
  assert.match(capture,/serviceWorkers:'block'/);
  assert.match(capture,/target\.origin===url\.origin \? route\.continue\(\) : route\.abort\(\)/);
  assert.doesNotMatch(capture,/\.click\(|\.fill\(|\.press\(/);
});
test('Eight desktop/tablet/mobile landscape and portrait sizes are covered',()=>{
  for (const pair of ['1440,900','1100,800','1024,768','768,1024','390,844','360,780','844,390','780,360']) {
    assert.ok(capture.includes(`[${pair}]`),`capture missing ${pair}`);
    assert.ok(spec.includes(`[${pair}]`),`browser test missing ${pair}`);
  }
});
test('Captured evidence cannot be mistaken for blank-page success or accepted parity',()=>{
  assert.match(capture,/getByRole\('textbox',\{name:\/email\/i\}\)/);
  assert.match(capture,/rootTextLength<8/);
  assert.match(capture,/CAPTURED_UNAPPROVED/);
  assert.match(capture,/horizontalOverflow/);
  assert.match(capture,/MANIFEST\.json/);
});
test('Real browser auth smoke asserts exact copy, accessible controls, focus, no overflow',()=>{
  assert.match(spec,/heading',\{name:'Welcome back'/);
  assert.match(spec,/getByRole\('textbox',\{name:'Email'/);
  assert.match(spec,/getByLabel\('Password'/);
  assert.match(spec,/toBeFocused\(\)/);
  assert.match(spec,/document\.documentElement\.scrollWidth>innerWidth\+2/);
  assert.match(spec,/runtimeErrors/);
});
test('Decorative authentication dashboard mockups have non-announcing alternatives',()=>{
  for (const p of ['LogIn','SignUp']) {
    const s=read(`apps/customer-ui/src/routes/auth-pages/${p}.tsx`);
    assert.match(s,/src=\{DashboardMockup\} alt="" aria-hidden="true"/);
  }
});
test('The original ErhaPay asset inventory and source-test hooks remain protected',()=>{
  assert.ok(existsSync('docs/design/ERHAPAY_ORIGINAL_VISUAL_ASSETS.json'));
  assert.match(read('package.json'),/erhapay-ui-inventory\.mjs --check/);
  assert.match(read('playwright.config.ts'),/customer-ui\/\*\.spec\.ts/);
});
