# TwiPay × preserved ErhaPay UI — Batch A verification

## Scope

**Preserved UI candidate** only. The existing TwiPay API, Next.js customer web, Next.js admin, database and worker remain intact. The original ErhaPay React/Vite UI is copied to `apps/customer-ui` and rebranded in displayed text to TwiPay. Original image/logo files are byte-for-byte preserved. This is not a production-accepted frontend swap.

### Auth source integration

Source mappings implemented and compared to the actual RC2 TwiPay API controllers:

| Browser behaviour | TwiPay endpoint | Status |
|---|---|---|
| Register and create secure session | `POST /v1/auth/register` | Wired in code; runtime BLOCKED |
| Login with password | `POST /v1/auth/login` | Wired in code; runtime BLOCKED |
| Restore session on load | `GET /v1/auth/me` | Wired in code; runtime BLOCKED |
| Server-side logout | `POST /v1/auth/logout` | Wired in code; runtime BLOCKED |
| MFA enabled check | `GET /v1/auth/mfa/status` | Wired in code; runtime BLOCKED |
| Enrolled TOTP step-up | `POST /v1/auth/mfa/challenge` | Wired in code; runtime BLOCKED |
| Session-bound CSRF for protected mutations | `GET /v1/auth/csrf` | Wired in code; runtime BLOCKED |

Login uses the backend-set HttpOnly cookie and never reads or writes authentication credentials to browser storage. ErhaPay's Google/Firebase and emailed OTP login workflows are not active. The old settings, account verification and password-reset forms are not enabled until verified API contracts exist. MFA enrollment remains a distinct future integration step and is **not claimed complete**.

### Product decisions

- **Permanently excluded:** betting. No mounted betting route or active link, with unused original sources retained only for traceability. Never enable betting.
- **Preserved but currently inactive:** e-PIN, international airtime/data, eSIM, mobile money, virtual cards, flight/hotel bookings, referrals and affiliate operations. Direct URLs redirect and normal customer nav filters them.
- **Next integration batches:** customer wallet/transfers, bills/utilities, events, operational status and customer settings. Legacy BillPadi endpoints return explicit `FEATURE_NOT_INTEGRATED` instead of sending incompatible requests. Real customer-money actions are **not enabled** by this batch.
- Original logo image is preserved despite TwiPay text rebranding. A new unique logo can replace it only after approval.
- Fictional card account details and hardcoded example bank account numbers removed from active UI sources. Legacy marketing testimonials and unsupported referral/card offers are not shown as verified TwiPay claims.

### Actual tests

| Command | Environment | Result | Evidence |
|---|---|---|---|
| `node --test docs/migration/test/batch-a.test.mjs` | Node 22.16.0, isolated container | **PASS 10/10** | `evidence/batch-a-regression.log` |
| `node scripts/typescript-syntax-check.mjs` | same | **PASS, 430 TS source files** | `evidence/syntax.log` |
| `node scripts/repository-security-check.mjs` | same | **PASS, 750 text files** | `evidence/security.log` |
| `node scripts/architecture-check.mjs` | same | PASS | `evidence/invariants.log` |
| `node scripts/financial-invariant-check.mjs` | same | PASS | `evidence/invariants.log` |
| `node scripts/services-events-invariant-check.mjs` | same | PASS | `evidence/invariants.log` |
| `node scripts/product-operations-invariant-check.mjs` | same | PASS | `evidence/invariants.log` |
| `node scripts/production-hardening-invariant-check.mjs` | same | PASS | `evidence/invariants.log` |
| `node scripts/git-history-secret-check.mjs` | same | PASS, existing tracked Git history | `evidence/invariants.log` |
| `git diff --check` | same | PASS (tracked diff only) | stdout/exit status |
| `npm ping --fetch-retries=0 --fetch-timeout=8000` | same | **BLOCKED** DNS `EAI_AGAIN` | registry unavailable |
| `pnpm install`, `pnpm --filter @twipay/customer-ui build` | no pnpm/dependency graph/registry | **BLOCKED** | Need real Node24/pnpm machine |
| Real browser login/registration/MFA/cookie/CSRF tests | no running stack here | **BLOCKED** | Requires developer machine and API/DB |
| Visual screenshot parity against ErhaPay | no browser-dependency installation | **BLOCKED** | Must compare 8 viewport sizes and routes |

The initial Batch A test implementation erroneously required `authApi.ts` to reference the CSRF route, although this is correctly accessed through the Axios interceptor. It failed **1/10** due to the test assertion, then was corrected; final rerun **10/10 PASS**. No financial service implementation changed to satisfy a test.

### Source baseline, uncertainty and preservation

- ErhaPay source archive supplied by the user: SHA-256 `aec7912e7d67e1d0db481f79544a048263dffae456198fa7adc6f2b19b0c84c6`.
- Exact per-file provenance/hashes recorded in `BATCH_A_PRESERVATION_INVENTORY.json`.
- This integration starts from TwiPay **RC2** already available in the chat, not the developer's newer local checkout with ADRs 016–018. Merge into the developer's newer repository only after checking conflicts and live contracts.
- Preexisting dirty files in the RC2 archive were preserved: `scripts/operations/{backup-postgres,restore-postgres,verify-restored-db}.sh`. No source reset, Git history rewrite or production release tag was made.
- The original customer app in `apps/web` remains untouched. The preserved ErhaPay-based UI is an isolated candidate at `apps/customer-ui` pending genuine Vite build, auth and visual qualification.
- No client-side JWT, refresh token, actual money mutation, backend feature flags or provider credentials were added.

## Required next action

On the developer's tested checkout, review `docs/migration/BATCH_A_PRESERVATION_INVENTORY.json`, run `pnpm install`, `pnpm --filter @twipay/customer-ui build`, `pnpm --filter @twipay/customer-ui dev`, and launch the API with `APP_URL` exactly matching the Vite origin. Execute registration/login/logout/MFA and cookie/CSRF negative E2E tests with test accounts, then resolve all type/build problems and compare ErhaPay/TwiPay screenshots before proposing frontend promotion.

**Status: Batch A SOURCE PRESERVATION + AUTH CONTRACT WIRING COMPLETE; runtime and browser qualification BLOCKED.**
