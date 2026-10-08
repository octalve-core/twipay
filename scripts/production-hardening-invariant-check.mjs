import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const read=(p)=>readFileSync(join(process.cwd(),p),'utf8');
const failures=[];
const requireMatch=(file,re,label)=>{const s=read(file);if(!re.test(s))failures.push(`${label} (${file})`)};
const requireAbsent=(file,re,label)=>{const s=read(file);if(re.test(s))failures.push(`${label} (${file})`)};
const requireFile=(file)=>{if(!existsSync(join(process.cwd(),file)))failures.push(`missing ${file}`)};

for(const file of [
  'packages/security/src/mfa.ts',
  'apps/api/src/modules/auth/application/mfa.service.ts',
  'apps/api/src/modules/auth/presentation/mfa.controller.ts',
  'apps/api/test/session-expiry.test.ts',
  'apps/api/test/financial-concurrency.integration.test.ts',
  'apps/worker/test/redis-worker.integration.test.ts',
  'tests/e2e/release-security.spec.ts',
  'packages/database/prisma/migrations/0005_production_hardening_mfa/migration.sql',
  'apps/web/proxy.ts','apps/admin/proxy.ts',
  'docs/release/provider-sandbox-qualification.md',
  'docs/release/attack-regression.md',
]) requireFile(file);

requireMatch('apps/api/src/modules/auth/application/session.service.ts',/IDLE_TTL_EXPIRED/,'idle session expiry must be runtime enforced');
requireMatch('apps/api/src/modules/auth/application/session.service.ts',/ABSOLUTE_TTL_EXPIRED/,'absolute session expiry must be runtime enforced');
requireMatch('apps/api/src/modules/auth/application/session.service.ts',/async rotate\(/,'security transition must rotate session');
requireMatch('apps/api/test/session-expiry.test.ts',/SESSION_IDLE_EXPIRED/,'idle expiry must have regression coverage');
requireMatch('apps/api/test/session-expiry.test.ts',/SESSION_EXPIRED/,'absolute expiry must have regression coverage');
requireMatch('apps/api/src/modules/auth/application/mfa.service.ts',/encryptSensitiveString\(secret/,'TOTP secret must be encrypted at rest');
requireMatch('apps/api/src/modules/auth/application/mfa.service.ts',/hashRecoveryCode/,'recovery codes must be keyed hashes at rest');
requireMatch('packages/security/src/mfa.ts',/lastAcceptedTimeStep/,'TOTP replay state must be checked');
requireMatch('packages/database/prisma/migrations/0005_production_hardening_mfa/migration.sql',/TOTP timestep must advance/,'database must guard TOTP replay timestep');
requireMatch('packages/database/prisma/migrations/0005_production_hardening_mfa/migration.sql',/security events are append-only/,'security evidence must be append-only');
requireMatch('apps/api/src/modules/operations/presentation/customer-operations.controller.ts',/requestPayout[\s\S]{0,800}requireMfa\(req\)/,'organizer payout request must require recent MFA');
requireMatch('apps/api/src/modules/product/presentation/product.controller.ts',/HIGH_RISK_FEATURES_RELEASE_QUALIFIED[\s\S]{0,400}requireMfa\(req\)/,'high-risk feature activation must require release qualification and recent MFA');
requireMatch('packages/database/prisma/migrations/0004_product_operations/migration.sql',/events\.refunds[^\n]*false|events\.refunds[\s\S]{0,160}FALSE/i,'refund feature flag must be seeded off');
requireMatch('packages/database/prisma/migrations/0004_product_operations/migration.sql',/operations\.organizer_payouts[^\n]*false|operations\.organizer_payouts[\s\S]{0,160}FALSE/i,'organizer payout feature flag must be seeded off');
requireMatch('apps/web/proxy.ts',/strict-dynamic/,'web CSP must be nonce-based');
requireMatch('apps/admin/proxy.ts',/strict-dynamic/,'admin CSP must be nonce-based');
requireAbsent('apps/web/proxy.ts',/script-src[^\n]*unsafe-inline/,'web CSP must not allow unsafe-inline scripts');
requireAbsent('apps/admin/proxy.ts',/script-src[^\n]*unsafe-inline/,'admin CSP must not allow unsafe-inline scripts');
requireMatch('apps/api/src/main.ts',/riskRatePolicy/,'API must use risk-specific rate limiting');
requireMatch('.env.example',/SESSION_IDLE_TTL_SECONDS=/,'idle TTL must be documented');
requireMatch('.env.example',/MFA_RECOVERY_HMAC_KEY=/,'MFA recovery HMAC key must be documented');
requireMatch('.env.example',/HIGH_RISK_FEATURES_RELEASE_QUALIFIED=false/,'release-qualification latch must default false');
requireAbsent('.env.example',/MFA_RECOVERY_HMAC_KEY=\S+/,'example must not contain MFA recovery secret');
requireMatch('package.json',/"node":\s*">=24 <25"/,'release Node range must stay Node 24');
requireMatch('package.json',/"packageManager":\s*"pnpm@12\.9\.1"/,'pnpm must stay pinned');
requireMatch('apps/web/package.json',/"next":\s*"16\.3\.8"/,'web Next.js must be on patched line');
requireMatch('apps/admin/package.json',/"next":\s*"16\.3\.8"/,'admin Next.js must be on patched line');

if(failures.length){console.error(`Production hardening invariant check FAILED (${failures.length}):`);for(const f of failures)console.error(` - ${f}`);process.exit(1)}
console.log('Production hardening invariant check PASS');
