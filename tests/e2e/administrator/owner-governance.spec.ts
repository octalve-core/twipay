import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { createHmac } from 'node:crypto';

/** This suite MUST run against a seeded disposable DB. Never print credentials or TOTP seeds. */
const env = process.env;
const api = env['TWIPAY_API_URL'] ?? 'http://127.0.0.1:4000';
const ownerA = { email: env['TWIPAY_OWNER_A_EMAIL'], password: env['TWIPAY_OWNER_A_PASSWORD'], totp: env['TWIPAY_OWNER_A_TOTP_SECRET'] };
const ownerB = { email: env['TWIPAY_OWNER_B_EMAIL'], password: env['TWIPAY_OWNER_B_PASSWORD'], totp: env['TWIPAY_OWNER_B_TOTP_SECRET'] };
const target = env['TWIPAY_QUALIFIED_STAFF_USER_ID'];
const staff = { email: env['TWIPAY_STAFF_EMAIL'], password: env['TWIPAY_STAFF_PASSWORD'] };

function preflight() {
  if(env['TWIPAY_QUALIFICATION_DISPOSABLE'] !== 'true' || env['NODE_ENV'] === 'production' ||
     env['OWNER_GOVERNANCE_SANDBOX_ENABLED'] !== 'true' || env['PROVIDER_OPERATIONS_SANDBOX_ENABLED'] === 'true')
    throw new Error('This qualification requires a disposable sandbox with provider routing changes disabled.');
  if(!ownerA.email || !ownerB.email || !ownerA.password || !ownerB.password || !ownerA.totp || !ownerB.totp || !staff.email || !staff.password ||
     ownerA.email.toLowerCase() === ownerB.email.toLowerCase() || !target || !/^[0-9a-f-]{36}$/i.test(target))
    throw new Error('Provision two distinct owner accounts with TOTP and a disposable verified target user.');
}
function decodeBase32(secret: string) {
  const abc='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0;const result:number[]=[];
  for(const ch of secret.toUpperCase().replace(/=|\s|-/g,'')){
    const n=abc.indexOf(ch);if(n===-1)throw new Error('Invalid qualification TOTP secret');
    value=(value<<5)|n;bits+=5;if(bits>=8){bits-=8;result.push((value>>bits)&255);}
  }
  return Buffer.from(result);
}
function totp(secret: string) {
  const c=Buffer.alloc(8);c.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30_000)));
  const d=createHmac('sha1',decodeBase32(secret)).update(c).digest();const p=d[d.length-1]!&15;
  return ((d.readUInt32BE(p)&0x7fffffff)%1_000_000).toString().padStart(6,'0');
}
async function loginAndStepUp(page:Page, identity:typeof ownerA) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(identity.email!);
  await page.getByLabel('Password').fill(identity.password!);
  await page.getByRole('button',{name:'Sign in'}).click();
  await page.goto('/security');
  await expect(page.getByText('Enabled.',{exact:false})).toBeVisible();
  await page.getByLabel('Authenticator/recovery code').fill(totp(identity.totp!));
  await page.getByRole('button',{name:'Step up this session'}).click();
  await expect(page.getByText('Recent MFA satisfied',{exact:false})).toBeVisible();
  await page.goto('/owner');
  await expect(page.getByRole('heading',{name:'Owner control centre'})).toBeVisible();
}
async function csrfMutation(context:BrowserContext, route:string, body:unknown={}) {
  const csrf=await context.request.get(`${api}/v1/auth/csrf`);
  expect(csrf.ok()).toBeTruthy();
  const {csrfToken}=await csrf.json();
  return context.request.post(`${api}/v1${route}`,{headers:{'x-csrf-token':csrfToken},data:body});
}

test.beforeAll(preflight);

test('non-authenticated owner route is not visible',async({page})=>{
  await page.goto('/owner');await expect(page).toHaveURL(/\/login/);
});

test('two real owner accounts: MFA, masked customer insight, approval independence and revocation',async({browser})=>{
  const contextA=await browser.newContext();const contextB=await browser.newContext();const contextStaff=await browser.newContext();
  try {
    const pageA=await contextA.newPage();const pageB=await contextB.newPage();
    // Existing verified customer gets an ordinary session, never owner access.
    const staffLogin=await contextStaff.request.post(`${api}/v1/auth/login`,{
      data:{email:staff.email,password:staff.password}});
    expect(staffLogin.ok()).toBeTruthy();
    const staffMe=await contextStaff.request.get(`${api}/v1/auth/me`);
    expect(staffMe.ok()).toBeTruthy();
    const beforeStaff=await staffMe.json();expect(beforeStaff.user.id).toBe(target);
    expect(beforeStaff.roles).not.toContain('SUPER_ADMIN');
    const forbidden=await contextStaff.request.get(`${api}/v1/operations/owner/overview`);
    expect(forbidden.status()).toBe(403);
    await loginAndStepUp(pageA,ownerA);
    await expect(pageA.getByText('Provider operations · failed/unknown')).toBeVisible();
    await pageA.goto('/owner/customers');
    await expect(pageA.getByText('Privacy first')).toBeVisible();
    await pageA.getByLabel('Exact email or customer UUID').fill(target!);
    await pageA.getByRole('button',{name:'Search securely'}).click();
    await expect(pageA.getByText(target!,{exact:false}).first()).toBeVisible();
    await pageA.getByRole('button',{name:'View aggregate activity'}).first().click();
    await expect(pageA.getByText('Observed activity',{exact:false})).toBeVisible();
    await pageA.goto('/owner/staff');
    await pageA.getByLabel('Verified, active customer UUID').fill(target!);
    await pageA.getByLabel('Role').selectOption('SUPPORT_AGENT');
    await pageA.getByLabel('Action').selectOption('GRANT');
    await pageA.getByLabel('Reason (20–500 characters)').fill('Disposable qualification staff role controlled by two independent owners');
    await pageA.getByRole('button',{name:'Prepare for independent approval'}).click();
    await expect(pageA.getByText('Proposal recorded',{exact:false})).toBeVisible();
    const pendingA=await contextA.request.get(`${api}/v1/operations/owner/staff/reviews`);
    expect(pendingA.ok()).toBeTruthy();
    const pending=(await pendingA.json()).reviews.filter((r:{targetUserId:string;roleCode:string;status:string})=>
      r.targetUserId===target && r.roleCode==='SUPPORT_AGENT' && r.status==='PREPARED');
    expect(pending.length).toBe(1);
    const reviewId=pending[0].id;
    // The maker cannot approve their own proposal even if they are SUPER_ADMIN.
    const selfCheck=await csrfMutation(contextA,`/operations/owner/staff/reviews/${reviewId}/approve`);
    expect(selfCheck.status()).toBe(403);
    await loginAndStepUp(pageB,ownerB);
    await pageB.goto('/owner/staff');
    // Approval is performed by the checker through the authenticated API in this qualification.
    const approval=await csrfMutation(contextB,`/operations/owner/staff/reviews/${reviewId}/approve`);
    expect(approval.ok()).toBeTruthy();
    const pendingAfter=await contextB.request.get(`${api}/v1/operations/owner/staff/reviews`);
    expect((await pendingAfter.json()).reviews.some((r:{id:string})=>r.id===reviewId)).toBe(false);
    // Target account's pre-existing session cannot inherit newly delegated permissions.
    const revoked=await contextStaff.request.get(`${api}/v1/auth/me`);
    expect(revoked.status()).toBe(401);
    const relogin=await contextStaff.request.post(`${api}/v1/auth/login`,{
      data:{email:staff.email,password:staff.password}});
    expect(relogin.ok()).toBeTruthy();
    const afterStaff=await (await contextStaff.request.get(`${api}/v1/auth/me`)).json();
    expect(afterStaff.roles).toContain('SUPPORT_AGENT');
    expect(afterStaff.roles).not.toContain('SUPER_ADMIN');
    const stillForbidden=await contextStaff.request.get(`${api}/v1/operations/owner/overview`);
    expect(stillForbidden.status()).toBe(403);
  } finally {await contextA.close();await contextB.close();await contextStaff.close();}
});
