import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {contactVerified} from '../../../apps/api/src/modules/auth/application/contact-permissions.ts';
const root=resolve(import.meta.dirname,'../../..');
const source=(path)=>readFileSync(resolve(root,path),'utf8');
const svc=source('apps/api/src/modules/auth/application/contact-verification.service.ts');
const ctrl=source('apps/api/src/modules/auth/presentation/auth.controller.ts');
const auth=source('apps/api/src/modules/auth/application/auth.service.ts');
const guard=source('apps/api/src/modules/auth/presentation/session-auth.guard.ts');

// Real runtime execution of the pure permission predicate, not database/HTTP qualification.
test('verified email permits dashboard regardless of unverified phone',()=>{
  assert.equal(contactVerified({emailVerifiedAt:new Date(), phoneE164:null,phoneVerifiedAt:null}),true);
});
test('verified phone requires both persisted E.164 value and timestamp',()=>{
  const ts=new Date();
  assert.equal(contactVerified({emailVerifiedAt:null, phoneE164:null,phoneVerifiedAt:ts}),false);
  assert.equal(contactVerified({emailVerifiedAt:null, phoneE164:'+2348012345678',phoneVerifiedAt:null}),false);
  assert.equal(contactVerified({emailVerifiedAt:null, phoneE164:'+2348012345678',phoneVerifiedAt:ts}),true);
});
test('registration leaves contact unverified, does not use PENDING lifecycle',()=>{
  assert.match(auth,/status: 'ACTIVE'/);
  assert.match(auth,/issueInitialWithTx\(tx, created.id, created.email\)/);
  assert.match(svc,/notifications.enqueueWithTx\(tx/);
  assert.match(auth,/sessions.create\(createdAccount.user.id/);
});
test('token entropy, short expiry, owner/email binding and one-way storage',()=>{
  assert.match(svc,/randomInt\(0, 1_000_000\)/);
  assert.match(svc,/createHmac\('sha256'/);
  assert.match(svc,/update\(userId\).*update\(email\).*update\(code\)/);
  assert.match(svc,/const CODE_TTL_MS = 10 \* 60_000/);
  assert.match(svc,/codeHash: digest\(userId, email, code\)/);
  assert.doesNotMatch(ctrl,/return \{[^\n]*codeHash|return \{[^\n]*code:/);
});
test('resends lock user, expire previous codes and limit daily and per-minute issuance',()=>{
  const resend=svc.slice(svc.indexOf('async resend('),svc.indexOf('async confirm('));
  assert.match(resend,/FOR UPDATE/);
  assert.match(resend,/RESEND_COOLDOWN_MS/);
  assert.match(resend,/DAILY_ISSUE_CAP/);
  assert.match(resend,/updateMany\(\{ where: \{ userId, consumedAt: null \}/);
});
test('confirmation locks identity, checks expiry/email/failed count and atomically consumes',()=>{
  const confirm=svc.slice(svc.indexOf('async confirm('));
  for (const constraint of ['FOR UPDATE', 'current.consumedAt','current.expiresAt <= now','current.email !== user.email','current.failedAttempts >= MAX_ATTEMPTS','matchDigest','consumedAt: now','emailVerifiedAt: now','CONTACT_EMAIL_VERIFIED']) assert.ok(confirm.includes(constraint), constraint);
  assert.match(confirm,/return false;[\s\S]*\)\.then\(\(valid\) =>/); // false commits attempt count, then throws outside transaction
});
test('backend protects non-auth controllers by default, exceptions are narrowly annotated',()=>{
  assert.match(guard,/!permitted && !contactVerified\(session.user\)/);
  assert.match(guard,/CONTACT_VERIFICATION_REQUIRED/);
  assert.match(guard,/MFA_CHALLENGE_REQUIRED/);
  assert.match(guard,/session.user.mfaCredentials.length > 0 && !mfaSatisfied/);
  assert.match(source('apps/api/src/modules/auth/application/session.service.ts'), /mfaCredentials: \{ where: \{ status: 'ACTIVE' \}/);
  for (const route of ["@Post('contact/email/resend')","@Post('contact/email/confirm')"]) assert.ok(ctrl.includes(route),route);
  assert.match(ctrl,/sessions.rotate\(principal.sessionId, \{ mfaSatisfiedAt: null/);
  const mfa=source('apps/api/src/modules/auth/presentation/mfa.controller.ts');
  assert.match(mfa,/@AllowUnverifiedContact\(\)\s+@Get\('status'\)/);
  assert.match(mfa,/@AllowUnverifiedContact\(\)\s+@Post\('challenge'\)/);
  assert.doesNotMatch(mfa,/@AllowUnverifiedContact\(\)\s+@Post\('enroll'\)/);
});
test('frontend requires verification on first signup, restored sessions and MFA flow',()=>{
  const ui=source('apps/customer-ui/src/routes/layout/AuthenticatedCustomerRoute.tsx');
  const signup=source('apps/customer-ui/src/components/Authentication/SignUpForm.tsx');
  assert.match(ui,/!user.contactVerified/);
  assert.match(signup,/navigate\("\/auth\/verify-email"/);
  assert.doesNotMatch(signup,/navigate\("\/dashboard"/);
  const app=source('apps/customer-ui/src/App.tsx');
  assert.doesNotMatch(app,/"\/auth\/verify-email", "\/auth\/verify-phone"/);
  const email=source('apps/customer-ui/src/routes/auth-pages/VerifyEmail.tsx');
  assert.match(email,/verifyEmail/);
  assert.match(email,/resendOtpFn/);
  assert.doesNotMatch(email,/\/auth\/user-details/);
});
test('migration is additive and does not alter old ledger or financial tables',()=>{
  const sql=source('packages/database/prisma/migrations/0006_verified_contact_onboarding/migration.sql');
  assert.match(sql,/CREATE TABLE "contact_verification_challenges"/);
  assert.match(sql,/FOREIGN KEY \("userId"\)/);
  assert.doesNotMatch(sql,/DROP TABLE|ALTER TABLE "(?:wallets|journal_|financial_|ledger_)/);
});
