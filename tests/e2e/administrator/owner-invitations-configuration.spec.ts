import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { createHmac } from 'node:crypto';

/** DISPOSABLE sandbox only. The invitee is an existing, email-verified, MFA-enrolled
 * fixture without AUDITOR role. A separate manual/signup+mailbox test is still needed
 * to validate the full unregistered-email registration journey.
 * Never use customer accounts, real provider credentials, or production infrastructure.
 */
const env = process.env;
const api = env['TWIPAY_API_URL'] ?? 'http://127.0.0.1:4000';
const ownerA = { email: env['TWIPAY_OWNER_A_EMAIL'], password: env['TWIPAY_OWNER_A_PASSWORD'], totp: env['TWIPAY_OWNER_A_TOTP_SECRET'] };
const ownerB = { email: env['TWIPAY_OWNER_B_EMAIL'], password: env['TWIPAY_OWNER_B_PASSWORD'], totp: env['TWIPAY_OWNER_B_TOTP_SECRET'] };
const invitee = { email: env['TWIPAY_INVITEE_EMAIL'], password: env['TWIPAY_INVITEE_PASSWORD'], totp: env['TWIPAY_INVITEE_TOTP_SECRET'] };
function preflight() {
  if (env['TWIPAY_QUALIFICATION_DISPOSABLE'] !== 'true' || env['NODE_ENV'] === 'production' ||
      env['OWNER_GOVERNANCE_SANDBOX_ENABLED'] !== 'true' || env['OWNER_CONFIGURATION_SANDBOX_ENABLED'] !== 'true' ||
      env['PROVIDER_OPERATIONS_SANDBOX_ENABLED'] === 'true' || env['FINANCIAL_AUTHORIZATION_SANDBOX_ENABLED'] === 'true') {
    throw new Error('Invitation and configuration qualification requires a disposable, finance-disabled nonproduction sandbox');
  }
  if (![ownerA.email, ownerB.email, ownerA.password, ownerB.password, ownerA.totp, ownerB.totp,
    invitee.email, invitee.password, invitee.totp].every(Boolean) ||
      new Set([ownerA.email?.toLowerCase(),ownerB.email?.toLowerCase(),invitee.email?.toLowerCase()]).size!==3) {
    throw new Error('Two distinct owners and one distinct, verified, MFA-enabled invitee are required');
  }
}
function totp(secret: string) {
  const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits=0, value=0;const bytes:number[]=[];
  for (const char of secret.toUpperCase().replace(/[=\s-]/g,'')) {
    const digit=letters.indexOf(char);if(digit<0)throw new Error('Invalid qualification TOTP');
    value=(value<<5)|digit;bits+=5;if(bits>=8){bits-=8;bytes.push((value>>bits)&255);}
  }
  const c=Buffer.alloc(8);c.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const digest=createHmac('sha1',Buffer.from(bytes)).update(c).digest();const offset=digest[digest.length-1]!&15;
  return ((digest.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
async function stepUp(context:BrowserContext, secret:string) {
  const csrf=await context.request.get(`${api}/v1/auth/csrf`);
  expect(csrf.ok()).toBeTruthy(); const {csrfToken}=await csrf.json();
  const response=await context.request.post(`${api}/v1/auth/mfa/challenge`,{
    headers:{'x-csrf-token':csrfToken},data:{code:totp(secret)},
  });
  expect(response.ok()).toBeTruthy();
}
async function login(page:Page, user:{email?:string;password?:string;totp?:string}) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email!);
  await page.getByLabel('Password').fill(user.password!);
  await page.getByRole('button',{name:'Sign in'}).click();
  await stepUp(page.context(),user.totp!);
}
async function post(context:BrowserContext,route:string,body:unknown={}) {
  const csrf=await context.request.get(`${api}/v1/auth/csrf`);
  expect(csrf.ok()).toBeTruthy();const {csrfToken}=await csrf.json();
  return context.request.post(`${api}/v1${route}`,{headers:{'x-csrf-token':csrfToken},data:body});
}
test.beforeAll(preflight);

test('two distinct owner approvals: invitation grants no role until email-bound MFA consent, then revokes all sessions',async({browser})=>{
  const a=await browser.newContext();const b=await browser.newContext();const i=await browser.newContext();
  try {
    await login(await a.newPage(),ownerA);await login(await b.newPage(),ownerB);
    const inviteeLogin=await i.request.post(`${api}/v1/auth/login`,{data:{email:invitee.email,password:invitee.password}});
    expect(inviteeLogin.ok()).toBeTruthy();
    const before=await (await i.request.get(`${api}/v1/auth/me`)).json();
    expect(before.roles).not.toContain('SUPER_ADMIN');expect(before.roles).not.toContain('AUDITOR');
    const pending=await post(a,'/operations/owner/staff/invitations',{
      email:invitee.email,roleCode:'AUDITOR',reason:'Disposable two-owner staff onboarding qualification with verified email consent',
    });expect(pending.status()).toBe(201);
    const {review}=await pending.json();const id=review.id;
    const noSelf=await post(a,`/operations/owner/staff/invitations/${id}/approve`);
    expect(noSelf.status()).toBe(403);
    const approved=await post(b,`/operations/owner/staff/invitations/${id}/approve`);
    expect(approved.status()).toBe(201);
    const preAcceptance=await (await i.request.get(`${api}/v1/auth/me`)).json();
    expect(preAcceptance.roles).not.toContain('AUDITOR');
    const mine=await i.request.get(`${api}/v1/operations/staff/invitations/mine`);
    expect(mine.ok()).toBeTruthy();expect((await mine.json()).invitations.some((v:{id:string})=>v.id===id)).toBe(true);
    const noMfa=await post(i,`/operations/staff/invitations/${id}/accept`);
    expect(noMfa.status()).toBe(403);
    await stepUp(i,invitee.totp!);
    const accepted=await post(i,`/operations/staff/invitations/${id}/accept`);
    expect(accepted.status()).toBe(201);
    const revoked=await i.request.get(`${api}/v1/auth/me`);expect(revoked.status()).toBe(401);
    const again=await i.request.post(`${api}/v1/auth/login`,{data:{email:invitee.email,password:invitee.password}});
    expect(again.ok()).toBeTruthy();
    const after=await (await i.request.get(`${api}/v1/auth/me`)).json();
    expect(after.roles).toContain('AUDITOR');expect(after.roles).not.toContain('SUPER_ADMIN');
    expect((await i.request.get(`${api}/v1/operations/owner/overview`)).status()).toBe(403);
  } finally {await a.close();await b.close();await i.close();}
});

test('independent owner approval of nonfinancial brand; old direct mutation path is closed',async({browser})=>{
  const a=await browser.newContext();const b=await browser.newContext();
  try {
    await login(await a.newPage(),ownerA);await login(await b.newPage(),ownerB);
    const before=await a.request.get(`${api}/v1/product/config`);expect(before.ok()).toBeTruthy();
    const cfg=(await before.json()).brand;
    const data={productName:cfg.productName,legalName:cfg.legalName,domain:cfg.domain,
      supportEmail:cfg.supportEmail,logoUrl:cfg.logoUrl,primaryColor:cfg.primaryColor,
      accentColor:cfg.accentColor,privacyUrl:cfg.privacyUrl,termsUrl:cfg.termsUrl};
    const oldCsrf=await a.request.get(`${api}/v1/auth/csrf`);const {csrfToken}=await oldCsrf.json();
    const direct=await a.request.patch(`${api}/v1/product/admin/brand`,{headers:{'x-csrf-token':csrfToken},data:{...data,reason:'Must be independently reviewed'}});
    expect(direct.status()).toBe(503);
    const proposal=await post(a,'/operations/owner/config/reviews',{
      kind:'BRAND',data,reason:'No-op verification of staged, independent branding governance in disposable sandbox',
    });expect(proposal.status()).toBe(201);
    const {review}=await proposal.json();const id=review.id;
    const self=await post(a,`/operations/owner/config/reviews/${id}/approve`);
    expect(self.status()).toBe(403);
    const approval=await post(b,`/operations/owner/config/reviews/${id}/approve`);
    expect(approval.status()).toBe(201);
    const repeat=await post(b,`/operations/owner/config/reviews/${id}/approve`);
    expect(repeat.status()).toBe(409);
  } finally {await a.close();await b.close();}
});
