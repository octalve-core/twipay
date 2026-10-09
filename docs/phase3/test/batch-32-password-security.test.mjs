/** Batch 3.2: executes the ACTUAL password service with an in-memory Prisma seam.
 * Not PostgreSQL, distributed rate-limit, email-provider or browser qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(import.meta.dirname, '../../..');
const contents = (path) => readFileSync(resolve(root, path), 'utf8');
const PEPPER = 'unit-test-pepper-length-greater-than-thirty-two-characters';
const old = process.env.SESSION_HASH_PEPPER;
process.env.SESSION_HASH_PEPPER = PEPPER;
process.on('exit', () => { if (old === undefined) delete process.env.SESSION_HASH_PEPPER; else process.env.SESSION_HASH_PEPPER = old; });
class HttpError extends Error { constructor(data, status) { super(data?.code ?? 'ERROR'); this.response = data; this.status = status; } }
const nest = { Injectable: () => (target) => target, ForbiddenException: class extends HttpError { constructor(data) { super(data, 403); } }, UnauthorizedException: class extends HttpError { constructor(data) { super(data, 401); } } };
const raw = contents('apps/api/src/modules/auth/application/password-security.service.ts');
function harness() {
  let clock = Date.parse('2026-10-09T12:00:00.000Z');
  class TestDate extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const code = ts.transpileModule(raw, { fileName:'password-security.service.ts', compilerOptions: { module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, experimentalDecorators:true } }).outputText;
  const mod = {exports:{}};
  new Function('require', 'module', 'exports', 'Date', code)((name) => {
    if (name === '@nestjs/common') return nest;
    if (name === '@twipay/security') return { normalizeEmail: email => email.trim().toLowerCase(), validatePasswordPolicy: pass => pass.length < 12 ? ['PASSWORD_TOO_SHORT'] : pass.length > 128 ? ['PASSWORD_TOO_LONG'] : [] };
    if (name.startsWith('node:')) return require(name);
    throw Error(`Unexpected dependency: ${name}`);
  }, mod, mod.exports, TestDate);
  const user = { id:'55555555-5555-4555-8555-555555555555', email:'user@twipay.test', emailVerifiedAt:new TestDate(), status:'ACTIVE' };
  let credential = 'hash:my-current-password';
  const challenges = [], notices = [], events = [], sessions = [{id:'current',status:'ACTIVE'},{id:'other',status:'ACTIVE'}];
  let sequence=0; let lock=Promise.resolve();
  const tx = {
    $queryRaw: async()=>[{id:user.id}],
    user:{ findUniqueOrThrow:async()=>({...user, passwordCredential:{userId:user.id}}) },
    passwordCredential:{
      findUnique:async()=>({passwordHash:credential}),
      update:async({data})=>{credential=data.passwordHash; return {passwordHash:credential};},
    },
    passwordResetChallenge:{
      findFirst: async()=>challenges.at(-1) ?? null,
      count:async({where})=>challenges.filter(x=>x.createdAt >= where.createdAt.gte).length,
      updateMany:async({where,data})=>{for(const x of challenges) if(x.userId===where.userId && x.consumedAt===null)x.consumedAt=data.consumedAt;},
      create:async({data})=>{const ch={...data,id:`challenge-${++sequence}`,createdAt:new TestDate(),consumedAt:null,failedAttempts:0};challenges.push(ch);return ch;},
      update:async({where})=>{const ch=challenges.find(c=>c.id===where.id); ch.failedAttempts++; return ch;},
    },
    session:{updateMany:async({where,data})=>{let count=0;for(const s of sessions){if(s.status!=='ACTIVE' || (where.id && where.id.not===s.id))continue;s.status=data.status;s.revokedAt=data.revokedAt;s.revokeReason=data.revokeReason;count++;}return {count};}},
    securityEvent:{create:async({data})=>{events.push(data);return data;}},
  };
  const prisma={
    $transaction:async(fn)=>{const waiting=lock;let done;lock=new Promise(resolve=>done=resolve);await waiting;try{return await fn(tx);}finally{done();}},
    user:{findUnique:async({where})=>where.email===user.email?{id:user.id}:null},
    session:{findMany:async()=>sessions.filter(s=>s.status==='ACTIVE').map(s=>({id:s.id,userAgent:'Test browser',createdAt:new TestDate(),lastSeenAt:new TestDate(),expiresAt:new TestDate(clock+100000)}))},
  };
  const notifications = {enqueueWithTx:async(_tx,notice)=>{notices.push(notice); return {id:String(notices.length)};},deliver:async()=>{}};
  const passwords = {hash:async x=>`hash:${x}`,verify:async(h,x)=>h===`hash:${x}`};
  const service=new mod.exports.PasswordSecurityService(prisma,passwords,notifications);
  return {service,user,challenges,notices,events,sessions,advance:(milliseconds)=>clock+=milliseconds, get credential(){return credential;}, resetCode(){const message=notices.findLast(n=>n.templateCode==='PASSWORD_RECOVERY');assert.ok(message);return message.text.match(/code is (\d{8})/)[1];}};
}
const request=(ctx)=>ctx.service.requestReset(' USER@TWIPAY.TEST ');
const complete=(ctx,code,newPassword='long-safe-next-password')=>ctx.service.completeReset(ctx.user.email,code,newPassword);

test('unknown account request has same public success shape and does not queue mail',async()=>{const ctx=harness();assert.deepEqual(await ctx.service.requestReset('unknown@twipay.test'),{ok:true});assert.equal(ctx.notices.length,0);});
test('unverified and suspended identities do not receive recovery codes',async()=>{const ctx=harness();ctx.user.emailVerifiedAt=null;assert.deepEqual(await request(ctx),{ok:true});ctx.user.emailVerifiedAt=new Date();ctx.user.status='SUSPENDED';assert.deepEqual(await request(ctx),{ok:true});assert.equal(ctx.challenges.length,0);});
test('recovery challenge uses an eight digit code and never stores the code or secrets in audit',async()=>{const ctx=harness();await request(ctx);assert.match(ctx.resetCode(),/^\d{8}$/);assert.match(ctx.challenges[0].codeHash,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(ctx.challenges).includes(ctx.resetCode()));assert.ok(!JSON.stringify(ctx.events).includes(ctx.resetCode()));});
test('correct code changes password, consumes all codes, revokes every session, creates alert without authenticating',async()=>{const ctx=harness();await request(ctx);assert.deepEqual(await complete(ctx,ctx.resetCode()),{ok:true});assert.equal(ctx.credential,'hash:long-safe-next-password');assert.ok(ctx.sessions.every(s=>s.status==='REVOKED'));assert.ok(ctx.challenges.every(x=>x.consumedAt));assert.ok(ctx.notices.some(x=>x.templateCode==='PASSWORD_RESET_SECURITY_ALERT'));});
test('replayed reset code cannot change password again',async()=>{const ctx=harness();await request(ctx);const code=ctx.resetCode();await complete(ctx,code);await assert.rejects(complete(ctx,code,'another-next-password'),{message:'RESET_CODE_INVALID'});});
test('expired challenge is rejected',async()=>{const ctx=harness();await request(ctx);ctx.advance(10*60_000+1);await assert.rejects(complete(ctx,ctx.resetCode()),{message:'RESET_CODE_INVALID'});});
test('five invalid attempts commit and lock the challenge',async()=>{const ctx=harness();await request(ctx);const code=ctx.resetCode(), wrong=code==='00000000'?'11111111':'00000000';for(let i=0;i<5;i++)await assert.rejects(complete(ctx,wrong),{message:'RESET_CODE_INVALID'});assert.equal(ctx.challenges[0].failedAttempts,5);await assert.rejects(complete(ctx,code),{message:'RESET_CODE_INVALID'});});
test('issuance cooldown and daily cap hold under concurrent requests',async()=>{const ctx=harness();await Promise.all([request(ctx),request(ctx)]);assert.equal(ctx.challenges.length,1);for(let i=0;i<5;i++){ctx.advance(60_001);await request(ctx);}assert.equal(ctx.challenges.length,5);});
test('concurrent code consumption allows one winner only',async()=>{const ctx=harness();await request(ctx);const code=ctx.resetCode();const outcomes=await Promise.allSettled([complete(ctx,code),complete(ctx,code)]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);});
test('new password cannot reuse existing password',async()=>{const ctx=harness();await request(ctx);await assert.rejects(complete(ctx,ctx.resetCode(),'my-current-password'),{message:'RESET_CODE_INVALID'});assert.ok(ctx.sessions.every(s=>s.status==='ACTIVE'));});
test('authenticated password change rejects incorrect current password and does not revoke sessions',async()=>{const ctx=harness();await assert.rejects(ctx.service.changePassword(ctx.user.id,'bad-password','long-new-secure-password'),{message:'PASSWORD_CHANGE_DENIED'});assert.ok(ctx.sessions.every(x=>x.status==='ACTIVE'));});
test('authenticated password change revokes all sessions and queues security notification',async()=>{const ctx=harness();assert.deepEqual(await ctx.service.changePassword(ctx.user.id,'my-current-password','long-new-secure-password'),{ok:true});assert.ok(ctx.sessions.every(x=>x.status==='REVOKED'));assert.ok(ctx.notices.some(x=>x.templateCode==='PASSWORD_CHANGED_SECURITY_ALERT'));});
test('password change invalidates any outstanding recovery challenges',async()=>{const ctx=harness();await request(ctx);await ctx.service.changePassword(ctx.user.id,'my-current-password','long-new-secure-password');assert.ok(ctx.challenges.every(x=>x.consumedAt));});
test('other-session revocation requires current password and leaves active session intact',async()=>{const ctx=harness();await assert.rejects(ctx.service.revokeOtherSessions(ctx.user.id,'current','wrong'),{message:'INVALID_CREDENTIALS'});assert.equal(ctx.sessions[1].status,'ACTIVE');assert.deepEqual(await ctx.service.revokeOtherSessions(ctx.user.id,'current','my-current-password'),{revoked:1});assert.equal(ctx.sessions[0].status,'ACTIVE');assert.equal(ctx.sessions[1].status,'REVOKED');});
test('password reset public routes are origin checked without requiring session CSRF; credential updates still require CSRF',()=>{const guard=contents('apps/api/src/modules/auth/presentation/request-security.guard.ts');const frontend=contents('apps/customer-ui/src/lib/api/axios.ts');assert.match(guard,/unauthenticatedBrowserMutations = new Set\(\[[^\n]*password\/reset\/complete/);assert.match(guard,/isAllowedBrowserOrigin/);assert.ok(!guard.match(/unauthenticatedBrowserMutations = new Set\(\[[^\n]*password\/change/));assert.match(frontend,/"\/auth\/password\/reset\/complete"/);});
test('password endpoints use strict request DTOs and authenticated changes guard',()=>{const controller=contents('apps/api/src/modules/auth/presentation/auth.controller.ts');assert.match(controller,/@Post\('password\/change'\)\s+@UseGuards\(SessionAuthGuard\)/);assert.match(controller,/PasswordResetCompleteSchema = z\.object\([^\n]*regex\(\/\^\\d\{8\}\$\//);assert.match(controller,/clearSessionCookies\(res\)/);});
test('recovery migration is additive; no financial tables touched',()=>{const sql=contents('packages/database/prisma/migrations/0007_password_recovery_and_sessions/migration.sql');assert.match(sql,/CREATE TABLE "password_reset_challenges"/);assert.doesNotMatch(sql,/DROP|ALTER TABLE "(?:wallets|ledger|journal|financial)/);});

test('public reset does not synchronously dispatch provider email, preventing provider-timing disclosure',()=>{assert.doesNotMatch(raw,/this\.notifications\.deliver\(/);});
test('invalid authenticated passwords return a forbidden response without invalidating valid client sessions', async()=>{const ctx=harness();await assert.rejects(ctx.service.changePassword(ctx.user.id,'incorrect','another-long-password'),err=>err.status===403);await assert.rejects(ctx.service.revokeOtherSessions(ctx.user.id,'current','incorrect'),err=>err.status===403);});
test('password strength helper and recovery UI use the same twelve-character minimum as the server',()=>{assert.match(contents('apps/customer-ui/src/lib/passwordStrengthChecker.ts'),/password\.length >= 12/);assert.match(contents('apps/customer-ui/src/lib/zodSchemas/auth.schema.ts'),/password: z\.string\(\)\.min\(12/);});
