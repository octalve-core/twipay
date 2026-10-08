# TwiPay single-master reconciliation checkpoint — 2026-10-08

## User-approved direction

- ONE continuously developed Octalve-owned TwiPay monorepo. **Original ErhaPay customer UI is authoritative**; preserve layouts, components, assets and original ErhaPay logo until user approves replacement. Product display name = TwiPay.
- Existing TwiPay NestJS/Fastify API, security/ledger/Postgres/Redis/BullMQ worker and Next.js admin are reused. Do not rebuild the backend or replace ErhaPay's interface with the simplified `apps/web` UI.
- Betting is permanently excluded; e-PIN, international airtime/data, eSIM/mobile money, cards, travel, referral/affiliate code retained **inactive** until future explicitly approved stages.
- Financial high-risk `events.refunds=false` and `operations.organizer_payouts=false` stay off pending real security, DB concurrency, provider and staging qualification.

## Reconciliation state, not a claim of latest backend merge

- User-provided remote: `https://github.com/octalve-core/twipay.git`.
- Attempted `git ls-remote ... HEAD`; FAILED: `Could not resolve host: github.com` in this container. Web retrieval also failed. GitHub plugin not installed, cannot inspect private repo here.
- **DO NOT CLAIM THE DEVELOPER'S LATEST CODE WAS MERGED**. ADRs 016–018, Prisma `@prisma/adapter-pg`, new `pg_advisory_xact_lock` `$executeRaw` logic and 18/18 builds / 32/32 task passes remain developer-reported, not independently verified here.
- Provisional repo: `apps/customer-ui` = preserved ErhaPay Vite UI, `apps/web` = historical simplified Next.js customer UI (not approved for visual replacement), `apps/admin`, `apps/api`, `apps/worker` from older TwiPay RC2.
- Starting local Git HEAD = `9bbad49aa478377efcba58f105fb12ec53f4d866`, branch `main`, tag `twipay-v1.0.0-rc.2`. Existing Batch A changes in untracked app/docs; prior operations-script changes also uncommitted. **Do not reset, discard, or force push**.
- Batch A archive SHA-256 `26178913c6fb12e35d6dfd6c4aa7a84f5b94bad017bd112d19e07fa1fea908c2`, verified before this update. Original preservation test confirms byte-for-byte original logo/assets unchanged.

## Safe isolated frontend corrections completed during reconciliation preparation

1. `apps/customer-ui/src/lib/api/axios.ts`: stopped erroneously exempting `POST /auth/logout` from CSRF acquisition. Older backend `RequestSecurityGuard` exempts ONLY unauthenticated registration/login; logout requires valid session, CSRF cookie/header, exact origin. The old client would not send that header, causing logout to fail. No backend security weakening.
2. `apps/customer-ui/src/components/Authentication/SignUpForm.tsx`: confirm new server session successfully via `refreshSession()` before notifying successful dashboard login; route to login with explanatory error if the session cannot be confirmed. Original ErhaPay UI/fields/layout remain unchanged.
3. `docs/migration/test/batch-a.test.mjs`: added 2 precise **source contract assertions** covering logout CSRF and signup session-order/error-flow; these are not live browser E2E tests.

## Actual checks on this local environment

- Node `v22.16.0`, not approved Node 24. No pnpm/dependency installation available; no reachable latest GitHub remote, Postgres, Redis, staging or user's localhost services.
- `node --test docs/migration/test/batch-a.test.mjs` => **12/12 PASS** (previous 10 Batch A tests plus 2 contract regressions).
- `node scripts/typescript-syntax-check.mjs` => PASS (430 source files).
- `node scripts/repository-security-check.mjs` => PASS (753 text files).
- `node scripts/architecture-check.mjs`, `financial-invariant-check.mjs`, `services-events-invariant-check.mjs`, `product-operations-invariant-check.mjs`, `production-hardening-invariant-check.mjs` => PASS.
- `node scripts/git-history-secret-check.mjs` => PASS (348 tracked paths, reachable patches). It does not cover uncommitted files in Git history.
- `git diff --check` => PASS; existing untracked files are not covered by Git diff.
- **BLOCKED, not PASS**: genuine developer backend reconciliation, Node 24/pnpm full build, PostgreSQL18, Redis8, real CSRF cookie and MFA browser flows, original-UI screenshots and provider integration.

## Essential follow-up before Batch B financial integration

1. Obtain verified developer repo via connected GitHub connector or user-uploaded sanitized latest ZIP; verify HEAD, release notes, ADRs 016–018, true lockfile, migrations, tests. Do NOT invent the GitHub state or replicate its changes from developer's prose.
2. Perform three-way Git reconciliation preserving the original ErhaPay UI and Batch A modifications; restore source branch and test evidence. Do not assume current older API is latest or force-push.
3. For local Vite candidate `http://localhost:5173`, backend `APP_URL` must match that exact origin if it is the active customer UI, while `ADMIN_URL` should match admin frontend. API CORS and request-security guards both use these settings. Test secure cookies and SameSite behaviour in real browser. Do not add wildcard CORS.
4. Execute actual login/register/logout/MFA and visuals in Playwright against the developer stack; only then proceed Batch B profile/KYC, Batch C financial integrations and later approved batches.
5. Retain **one authoritative master repository**. Update this checkpoint and the Master Continuation in the Library. Internal preservation of an updated canonical file is fine; avoid user-facing ZIP after each batch. Final user-facing consolidated ZIP only after completion.

## Continued Batch B customer profile/KYC checkpoint (2026-10-08)

- The user's request was to **merge the developer's latest backend and finish Batch B with accurate real browser verification**. The remote is STILL inaccessible: `git ls-remote https://github.com/octalve-core/twipay.git HEAD` => `Could not resolve host: github.com`. Latest developer commits / ADR 016–018 were NOT merged. Do not fake or replicate them based on narrative.
- Actual old RC2 backend controllers confirm `PATCH /v1/auth/me` for first/last names and KYC initiation/continuation/history. Changes are limited to `apps/customer-ui` plus source-contract regression tests/docs and a Playwright test specification; no financial/ledger/provider backend edits.
- Profile: original ErhaPay account settings styling preserved; only given/family names write to API. Email, username, country, state read-only. Photo-upload action retains old visual but disabled pending a verified TwiPay-owned media contract. Original image assets and logo unchanged.
- KYC: new ErhaPay-style settings page for BVN/NIN; 11-digit check, explicit consent, typed `GET/POST /v1/kyc/verifications` and `POST .../:id/continue`, idempotency keys, CSRF, provider-supplied BVN methods, live history with masked last 4, no browser persistence of raw number. Pending/unknown responses are not treated as verified. Actual provider usage MUST be separately sandbox qualified; do not test chargeable KYC calls with real numbers.
- Batch A + Batch B static contract suite now **22/22 PASS**; syntax check PASS (432 files); security scanner PASS (761 text files); architecture, finance, events, product, hardening, existing Git history secret scan all PASS. These are not browser or DB/provider tests.
- Blocking environment: node v22 vs required v24, no pnpm-lock.yaml in provisional master, no installed frontend modules, no API/Vite/Postgres/Redis services at localhost ports, no private GitHub checkout; frontend `npm run build` failed on missing deps. Playwright tests authored at `tests/e2e/customer-ui/auth-profile-kyc.spec.ts` with separate config `playwright.customer-ui.config.ts` but NOT EXECUTED. Avoid production claim.
- `docs/migration/BATCH_B_PROFILE_KYC_IMPLEMENTATION_2026-10-08.md` documents exact contracts, completed work and runtime qualification steps.
- Next chat first reconcile latest developer Git repo via connected GitHub or sanitized latest ZIP; compare actual migration/lockfile/ADRs/test baseline, then real Node24 build, browser cookies/CSRF/login/MFA, KYC sandbox/provider flows, customer UI visual parity. Only proceed toward Batch C once trust boundary is genuinely tested.
