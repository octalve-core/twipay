/** Batch 2.4: customer copy contract. Source checks; browser UX is not qualified here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL(`../../../${path}`,import.meta.url),'utf8');
const UI='apps/customer-ui/src/';

test('the page title, favicon and description carry the TwiPay brand',()=>{
 const html=read('apps/customer-ui/index.html');
 assert.match(html, /<title>TwiPay<\/title>/);
 assert.match(html, /rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,/);
 assert.match(html, /name="description" content="Keep your TwiPay account/);
});
test('customer login uses welcoming copy and avoids inactive authentication promises',()=>{
 const login=read(UI+'components/Authentication/LogInForm.tsx');
 const signup=read(UI+'components/Authentication/SignUpForm.tsx');
 assert.match(login,/Welcome back/);assert.match(login,/Jump right back in/);
 assert.match(login,/to="\/faqs"/);
 assert.doesNotMatch(login, /Remember for 30 days|not yet available|HttpOnly|localStorage/);
 assert.match(signup,/Get started with TwiPay/);
 assert.doesNotMatch(signup,/Referral code \(not yet available\)|Enter a referral code/);
});
test('legacy simplified Next.js login no longer explains session internals to customers',()=>{
 const login=read('apps/web/app/login/page.tsx');
 const profile=read('apps/web/app/profile/page.tsx');
 assert.match(login,/Jump right back in/);
 for(const x of [login,profile])assert.doesNotMatch(x,/HttpOnly|localStorage|SameSite|security posture/);
});
test('landing-page claims are customer-friendly and evidence-respecting',()=>{
 const hero=read(UI+'components/external-pages/homepage/Hero.tsx');
 const logos=read(UI+'components/external-pages/homepage/Partnerships.tsx');
 const quote=read(UI+'components/external-pages/homepage/Testimonial.tsx');
 const download=read(UI+'components/external-pages/homepage/MobileAppLinks.tsx');
 const why=read(UI+'components/external-pages/homepage/WhyUse.tsx');
 assert.match(hero,/Everyday payments, made simpler/);
 assert.match(hero,/to="\/auth\/signup"/);
 assert.doesNotMatch(hero,/MVP is live|number 1 VTU|Mobile_app_store/);
 assert.doesNotMatch(logos,/world.s largest companies|partnerships\.map/);
 assert.doesNotMatch(quote,/Folake Festus|Bill payment is so much easier/);
 assert.doesNotMatch(download,/Mobile_app_store|<button/);
 assert.doesNotMatch(why,/number one VTU platform/);
});
test('no unavailable financial service leaks sandbox qualification to customer-facing notices',()=>{
 const paths=[
  'components/dashboard/add-funds/SelectPaymentMethod.tsx',
  'components/dashboard/withdraw-funds/EnterAmount.tsx',
  'components/dashboard/withdraw-funds/RecipientDetailForm.tsx',
  'components/dashboard/withdraw-funds/ConfirmFundsWithdrawal.tsx',
  'components/dashboard/services/IntegratedBillService.tsx',
  'components/dashboard/events/ConfirmEventsBooking.tsx',
  'components/dashboard/static-account/CreateStaticAccount.tsx',
 ];
 for(const path of paths){
  const x=read(UI+path);
  assert.match(x,/temporarily unavailable|currently paused/,path);
  assert.doesNotMatch(x,/sandbox verification|sandbox qualification|sandbox-only integration|unqualified/,path);
  assert.match(x,/VITE_TWIPAY_[A-Z_]*SANDBOX_ENABLED/,path); // enforcement unchanged
 }
});
test('payment confirmations remain status-safe with plain-language messages',()=>{
 const funding=read(UI+'components/dashboard/add-funds/MakePayment.tsx');
 const event=read(UI+'components/dashboard/events/ConfirmEventsBooking.tsx');
 assert.match(funding,/safeCheckoutUrl/);
 assert.match(funding,/checking this payment|payment is confirmed/);
 assert.match(event,/quote\.data/);
 assert.match(event,/checkoutEvent/);
 assert.doesNotMatch(funding,/ledger-backed|provider reconciliation/);
});
test('non-functional contact form cannot pretend to deliver a message',()=>{
 const form=read(UI+'components/external-pages/contact-us-page/ContactUsForm.tsx');
 assert.match(form,/<fieldset disabled(?:\s|>)/);
 assert.match(form,/Messaging temporarily unavailable/);
 assert.match(form,/event => event\.preventDefault\(\)/);
 assert.doesNotMatch(form, /onSubmit=\{handleSubmit\(onSubmit\)\}/);
});
test('retired in-app transfers have a plain message and no financial action',()=>{
 const page=read(UI+'routes/dashboard/TransferFunds.tsx');
 assert.match(page,/aren.t available right now/);
 assert.doesNotMatch(page,/retired ErhaPay API|not yet integrated/);
 assert.doesNotMatch(page,/initiateBankTransfer|axios\.post/);
});

test('request security codes remain unchanged but customer error text contains no infrastructure details',()=>{
 const source=read(UI+'lib/api/axios.ts');
 for(const code of ['API_NOT_CONFIGURED','FEATURE_NOT_INTEGRATED','CSRF_UNAVAILABLE'])assert.match(source,new RegExp(code));
 assert.doesNotMatch(source,/TwiPay API URL is not configured|ErhaPay feature has not yet been integrated|Cannot obtain CSRF authorization/);
 assert.match(source,/isAllowedIntegratedRoute/);
});
