# CURRENT MASTER CHECKPOINT — PHASE 5.4 NOTIFICATION INBOX & PREFERENCES (2026-10-09)

**Use the latest exact Git HEAD extracted from the single Coov Technologies Library master.** The source checkpoint began at `2d7ffe12c6a4379e387354b31e296797e0e51f3d`, on `phase3/low-friction-contact-20261009`. This version implements `0017_notification_inbox_preferences`, a new persisted owner-scoped safe notification inbox with read/unread state and owner-validated pagination, optional support/event in-app preferences, optional support-email suppression, and a restricted aggregate-only delivery-health operations view. Do not treat acceptance by an email provider as inbox read status, and do not mirror OTP/reset/enrollment codes or arbitrary delivery text in the inbox. The old metadata delivery-history endpoint is retained separately. Original ErhaPay visuals and default-off financial/event controls remain unchanged.

**Evidence:** 433/433 dependency-light offline tests passed, including 13 new Phase 5.4 mocked actual-service/security tests; repository scanners and original 123 visual assets passed. Full Node24 workspace build, Prisma migration against PostgreSQL18, Redis8 worker, real HTTP/CSRF, and browser/provider testing remain **NOT EXECUTED / BLOCKED** (preflight 5 pass, 0 fail, 9 blocked). Read `docs/phase5/BATCH_5_4_NOTIFICATION_INBOX_PREFERENCES_ADMINISTRATION_2026-10-09.md`. Next: Phase 6 real runtime, browser, accessibility and sandbox security qualification before any production activation. Never restart, overwrite ErhaPay with `apps/web`, or enable unqualified financial services.

---

# TWIPAY — AUTHORITATIVE NEXT-CHAT CONTINUATION & ENGINEERING CONTRACT

**Prepared:** 2026-10-08 (Africa/Lagos)  
**Project:** Coov Technologies / Octalve — TwiPay  
**Purpose:** Preserve **the user's latest intent**, decisions, code provenance, Git state, blockers, exact next tasks, and non-negotiable controls between chats. **Read this document completely before changing a file.**

> **THIS OVERRIDES OLDER DIRECTION CONFLICTS.** The original 2026-10-08 `TWIPAY_NEW_CHAT_CONTINUATION_BRIEF(1).md` incorrectly says ErhaPay is *only* UX reference material. The USER HAS CORRECTED THAT: **ErhaPay's existing customer frontend is the visual and interaction source of truth.** Preserve it; power it with the existing TwiPay backend. Do not replace the ErhaPay UI with the simplified Next.js UI created earlier. Other earlier architecture/security requirements still apply unless an explicit user decision supersedes them.

## A. Exact product decisions (must not drift)

1. Brand is **TwiPay**, owned by Octalve, independent of COOV. Existing ErhaPay frontend must be rebranded to TwiPay; keep **ErhaPay's original logo files** unchanged temporarily until user approves replacement. Preserve layout, components, spacing, responsiveness, forms, animations, icons and flows. No undesired redesign.
2. Reuse the **existing TwiPay NestJS/Fastify backend**, Postgres 18/Prisma 7 ledger, Redis/BullMQ worker, existing admin operations UI, provider abstractions, security, migrations, history. Do not build a new incompatible backend or silently discard developer's subsequent fixes.
3. **One continuously maintained monorepo, not a separate ZIP per batch.** Git commits/checkpoints and verification at each batch; **one consolidated final ZIP** at end of Batches A–F. The latest developer checkout, after verification, should be integrated into the master; protect any local interim WIP.
4. **Betting is permanently excluded**. No betting feature, route, navigation, marketing or backend work. Earlier ErhaPay betting source in the preservation candidate exists solely as archival traceability and must not be compiled or activated; plan to remove it from final deliverable once the preservation comparison is safely recorded. Distinguish **e-PIN**, which is a future module to preserve but not enable.
5. Retain in source **inactive** for future, without showing as working or making uncontrolled calls: e-PIN; international airtime/data; eSIM and mobile money; virtual cards; flight/hotel booking; referrals/affiliate. Do not implement those during current core integration batches unless user authorizes a change.
6. Current focus: authenticate existing ErhaPay UI with own backend, then wallet/transfers, utilities, events, final browser/security qualification. No fake balances, credentials, accounts, transactions or provider outcomes in real UX.
7. **High-risk gates stay OFF**: `events.refunds=false` and `operations.organizer_payouts=false` in deployment until MFA, maker/checker, DB concurrency, provider evidence, and real staging qualification pass.
8. Security baseline cannot be weakened to make code compile: immutable/sealed balanced double-entry ledger, integer minor units, ledger-derived balances and DB holds, scoped idempotency, `UNKNOWN` same-provider reconciliation, no blind cross-provider retry, Argon2id, opaque HttpOnly browser sessions, exact-origin/CSRF, TOTP MFA, BOLA/RBAC, maker/checker, sensitive-data encryption, append-only audit, protected ticket credentials. No runtime OpenAI/phone-home DRM. Secrets server-side only.
9. **Do not label source-only checks as live tests**. Report exact executed commands, environment, PASS/FAIL/BLOCKED and logs. Production readiness requires actual builds, browser E2E, DB/Redis concurrency and provider/staging security qualification.

## B. Source-of-truth provenance and verified status (as of handoff)

### GitHub remote — developer's repository
- User-supplied remote: `https://github.com/octalve-core/twipay.git` (may be private).
- Git remote was **NOT READ** in current tool environment: `git ls-remote` failed `Could not resolve host: github.com`; a web open also failed. GitHub plugin was discovered as **not installed/connected**. **DO NOT imply code from GitHub was merged, reviewed, or cloned.**
- Developer separately **reported** latest locally working checkout with 18/18 build tasks, 32/32 workspace test tasks, PostgreSQL 18 (localhost:5435), Redis 8 (localhost:6382), Next.js customer/admin (3000/3001) and API Swagger (4000/docs). He reported ADRs:
  - `docs/adr/016-prisma-7-driver-adapter-and-docker-backing-services.md`: `@prisma/adapter-pg`;
  - `docs/adr/017-transactional-advisory-locking-and-concurrency.md`: `pg_advisory_xact_lock` executed with `$executeRaw`;
  - `docs/adr/018-test-suite-isolation-and-dynamic-qualification.md`: test runner and fixture improvements.
  These are **UNVERIFIED REPORTS** until GitHub access or a developer-produced clean ZIP is available; do not overwrite those fixes with the older backend!

### Current locally inspected provisional monorepo
- Working directory at preparation time: `/mnt/data/twipay-erhapay-integration/twipay`; availability across future chat sessions **NOT GUARANTEED**. Recover from permanent Project/Library/attached archive, not from assumed sandbox paths.
- Source artifact: `TWIPAY_BATCH_A_PRESERVED_ERHAPAY_AUTH_CANDIDATE.zip` from earlier chat (original copy `/mnt/data/twipay-erhapay-integration/out/`); verified SHA-256 `26178913c6fb12e35d6dfd6c4aa7a84f5b94bad017bd112d19e07fa1fea908c2`.
- This is the **PROVISIONAL master** and is **NOT** the latest GitHub backend. It combines RC2 + ErhaPay UI candidate but **does not** include developer ADRs 016–018.
- Git HEAD: `9bbad49aa478377efcba58f105fb12ec53f4d866`; main; tag `twipay-v1.0.0-rc.2`. Original Batch 4 baseline HEAD `1a3e123f6363ffc80ad2e4560f57120fa9c2e0b2`; tag `batch-04-handoff`.
- Provisional worktree at inspection: **uncommitted** changes to `scripts/operations/{backup-postgres,restore-postgres,verify-restored-db}.sh` plus **untracked** `apps/customer-ui/` and `docs/migration/`. **Preserve these exactly. Do not discard as unimportant.** It contains no developer-latest merge, so don't tag production.
- Existing runtime apps: `apps/web` (original Next.js customer UI — **do not promote** as ErhaPay replacement), `apps/customer-ui` (ErhaPay React/Vite preserved UI candidate — intended authoritative look), `apps/admin` (Next.js operations), `apps/api` (NestJS/Fastify), `apps/worker` (BullMQ).
- Original user-attached ErhaPay source: `erhapay-source(2).zip` with SHA-256 `aec7912e7d67e1d0db481f79544a048263dffae456198fa7adc6f2b19b0c84c6`. Also exists in Library as `erhapay-source(1).zip` with same relevant role; when possible prefer attached `(2)` authoritative source and hash-check before diffing.
- ErhaPay was 460 source archive files, 443 under `src/`, 141 image/asset binaries; preservation inventory recorded 363 of 460 unchanged, 97 intentional source changes. All 141 binaries originally preserved byte-for-byte (including logo). Details in `docs/migration/BATCH_A_PRESERVATION_INVENTORY.json` and `BATCH_A_PRESERVATION_REPORT.md`.
- RC2 root `package.json` specified `pnpm@12.9.1`, `Node >=24 <25`. Docker/source report from developer may supersede after verification. No genuine current backend latest lockfile has been obtained in this chat.

### Actual Batch A changes and verification
- In `apps/customer-ui` the original React 18 / TypeScript / Vite 6 / React Router 7 UI structure, visual components and assets retained, product text rebranded TwiPay, original ErhaPay logo kept pending approved replacement.
- Old hardcoded `https://js.billpadi.com/api/v1` and browser `localStorage` access/refresh bearer-token authentication were replaced for active auth entry points with source-wired TwiPay API flows; inherited auth console credential logging removed; no client-side credential storage. Inactive legacy financial/settings API calls **fail closed** with `FEATURE_NOT_INTEGRATED`.
- API routes wired at source: POST `/v1/auth/register`, POST `/v1/auth/login`, GET `/v1/auth/me`, POST `/v1/auth/logout`, GET `/v1/auth/mfa/status`, POST `/v1/auth/mfa/challenge`, GET `/v1/auth/csrf`. **Browser E2E still needed**, as do enrollment/recovery/settings integration.
- Future modules' routes/nav disabled; permanent betting route absent. Event dummy data cannot be presented as genuine events; fake card details removed from active UI.
- Executed `node --test docs/migration/test/batch-a.test.mjs` on Node v22.16.0: **10/10 PASS**, rerun during this handoff. Earlier TypeScript syntax/security/invariant checks were source-level PASS per Batch A report. npm registry/network blocked for `pnpm install`, so **Vite build, actual login, cookie/CSRF browser E2E, visual parity unexecuted**. No production qualification claim.
- Two earlier artifacts: `BATCH_A_PRESERVATION_REPORT.md`, `BATCH_A_VERIFICATION.md`, plus per-file JSON inventory and `docs/migration/INTEGRATION_NEXT_STEPS.md`; **read them before work**.

## C. Integration strategy: one codebase, no redesign

**Prefer latest developer GitHub checkout as BASE ONCE VERIFIED**, and carefully port the current `apps/customer-ui` + `docs/migration` diffs into it using Git diff/three-way comparison and acceptance tests. The new app may remain Vite to preserve existing UI while integration proceeds; migrating to Next.js is NOT reason to reconstruct design. A Next.js migration is a separate, visual-parity-gated change, not a default first step. Existing `apps/web` remains as historical implementation until explicit promotion decision.

- Do not switch remote, force-push, rewrite history, commit secrets, discard branches, or create another unrelated repository without reconciling developer HEAD.
- If GitHub inaccessible: **use this local provisional master** for source-only planning and isolated improvements; do **not claim** latest developer fixes have been merged, and do not perform destructive backend merges. GitHub connection via user-authorized GitHub plugin or developer's clean ZIP is preferred. Avoid a new blank backend.
- Root monorepo remains Octalve/TwiPay, not COOV. Original ErhaPay visuals are the customer UI authority. Admin/API/database/worker remain separate protected modules.
- Maintain a single ordered change log, file preservation inventory, security gates, and sequential Git commits; consolidate for ONE user-facing final delivery at conclusion. Interim internal snapshots are okay but don't overwhelm user with numerous ZIPs.

## D. Remaining sequential batches and exit criteria

### Establish one verified master (IMMEDIATE NEXT STEP)
1. Try GitHub connector if connected or retrieve clean checkout/ZIP; verify actual remote HEAD, status, tags, auth/build logs, ADR 016–018, Prisma driver, advisory transaction locks, migrations, `pnpm-lock.yaml`.
2. Back up both source trees. Merge into one Git repository, **not** two separate monorepos. Treat conflicting newer financial/backend changes as evidence required; never blindly override latest backend.
3. Keep ErhaPay UI and approved logo assets intact; preserve any local Batch A auth improvements and unknown/blocked workflow states.
4. Run `pnpm install --frozen-lockfile` only if genuine lockfile exists. Execute build/lint/typecheck and integration checks in genuine Node 24 environment when available; avoid fabricating results. Verify Git status/commit and update this document.
5. Establish screenshot references from actual original ErhaPay running UI before changing its layouts.

### Batch B — Authentication, MFA, profile, KYC
- On existing ErhaPay pages: real session-cookie login/register/logout/restore; exact origin and CSRF; MFA enrollment/challenge/recovery/step-up; profile, password/recovery only with verified server contracts; KYC eligibility; role/ownership protections.
- Tests: actual browser cookies HttpOnly/Secure/SameSite, no JWT/localStorage, failure states, concurrent session revocation, BOLA and MFA replay. Do not claim success from mock-only tests.

### Batch C — Wallet, funding, virtual accounts, transfers, history
- Integrate preserved UI components with `GET /v1/wallets`, payment collections, transfer bank resolution, transfer, VA, history; typed response adapters; exact money minor units, persistent idempotency keys per logical action, UNKNOWN same-provider requery, held funds, provider evidence.
- Tests: real Postgres advisory locks, concurrency/no double debit, duplicate-click behaviour, provider timeout; preserve ledger architecture and UX.

### Batch D — Supported utilities
- Airtime, data, electricity, cable only via verified TwiPay service catalogue/validation/vend contracts; preserve ErhaPay forms; stop old external BillPadi calls; verify SKU mapping, receipts, UNKNOWN reconciliation and rate limits. Inactive future services stay hidden and fail closed.

### Batch E — Events/ticketing/customer operations
- Preserve UI; replace dummy event data with real TwiPay events/tickets/organizers/check-in/capacity; customer disputes and supported notifications/receipts; high-risk refunds and organizer payout remain gated OFF. Avoid unverified travel, cards, referral operations.

### Batch F — Full integrated qualification and single final delivery
- Real Node24/pnpm build + lockfile; Postgres18/Prisma migrations and concurrency; Redis8/BullMQ; provider sandboxes; Playwright 8-viewport screenshot comparisons with original ErhaPay UI; customer/admin/MFA/BOLA/CSRF/UX/edge cases; SAST/secrets/SBOM/backup recovery/rollback; staging deployment. Resolve real failures, then one final ZIP with Git history, exact checksum, commands and PASS/FAIL/BLOCKED matrix. Production-only after gates pass.

## E. Non-negotiable testing / security details

- Never silently promote staging features to production; never claim 18/18 build or 32/32 workspace tasks yourself until verifying developer's logs and actual Git HEAD. Never claim tests run on user's PC from ChatGPT container.
- **No live provider keys in a browser**. Session cookies and CSRF origin configuration must account for Vite customer UI origin (`http://localhost:5173` unless verified otherwise) vs API origin (`http://localhost:4000`). Validate cookie/SameSite/CORS with real browser, not only unit tests.
- No direct provider SDK calls from browser; no trusting UI totals; ledger derived balances and integer minor units; no fallback to cross-provider after possible request submission.
- For money actions, disable duplicate-submit and persist the idempotency key across retries of the same logical operation. Existing original RC2 `apps/web` autogenerated keys per call may not guarantee UI double-click safety; check when migrating.
- Approved local developer services reported: customer 3000, admin 3001, API 4000, PostgreSQL 5435, Redis 6382. **Reported**, not accessible/verified in this execution environment.
- Do not copy raw third-party ErhaPay legacy backend architecture or external authentication; reuse visual source and replace integration boundary only.
- Do not lose the user's approved branding rule: **name TwiPay; original ErhaPay logo temporarily**. Do not use prior AI-generated TwiPay logo without explicit approval.

## F. What to do in the next chat — no repeated questions

**Start by saying:** 'I am continuing the SAME TwiPay master, using ErhaPay's UI as the source of truth. I will inspect the latest GitHub checkout and merge it with our Batch A work; I won't reconstruct the UI or backend.'

Then:
1. Read this file, `docs/migration/{BATCH_A_PRESERVATION_REPORT.md,BATCH_A_VERIFICATION.md,BATCH_A_PRESERVATION_INVENTORY.json,INTEGRATION_NEXT_STEPS.md}` and the original architecture/security docs.
2. Inspect real Git status and archives; verify SHA-256.
3. Resolve GitHub read permission. If repo unavailable, continue from existing master **without falsely claiming latest backend**; prefer the developer's checkout before financial integration.
4. Produce a **specific merge/conflict map** of latest developer changes vs ErhaPay UI additions; do NOT start a new project or blanket-copy code.
5. Proceed to Batch B only on a reconciled base, using executable tests and one continuous repository; preserve user-facing ErhaPay screenshots.
6. End each work interval with current repo state, changed files, tests, remaining blockers, and explicit next step; **do not create or ask user to download separate ZIP after every batch**.

### Files readily available in Coov Technologies Project/Library
- User-attached `erhapay-source(2).zip` (also Library copy `erhapay-source(1).zip`).
- Original 39-KB `TWIPAY_NEW_CHAT_CONTINUATION_BRIEF(1).md` (**overridden only where latest user instruction conflicts**).
- `TWIPAY_BATCH_A_PRESERVED_ERHAPAY_AUTH_CANDIDATE.zip` (latest source-only integration candidate, 14 MB); use verified SHA above.
- `BATCH_A_PRESERVATION_REPORT.md`, `BATCH_A_VERIFICATION.md`, `BATCH_A_PRESERVATION_INVENTORY.json`.
- Previous RC2 `TWIPAY_BATCH_05_RC2_LOCAL_VERIFIED.zip` (superseded by Batch A candidate for frontend; RC2 is historical baseline, not developer latest).

**STOP CONDITION:** If exact developer GitHub HEAD/ZIP cannot be obtained, tell user latest developer fixes are not yet merged. Do not invent them, and do not override known good code. Work can continue on safe, isolated frontend planning/reconciliation prep only until backend base is verified.

## Same-master Batch B checkpoint — 2026-10-08 (MFA UI/source integration)

The **latest developer GitHub checkout was still inaccessible** (`git ls-remote` DNS failure). Developer ADRs 016–018 remain unverified/unmerged; do not assert otherwise. Worked solely inside the existing provisional master `/mnt/data/twipay-erhapay-integration/twipay`, preserving all previously untracked frontend and documentation and the backup/restore WIP. Pre-change full-repo archive made in `twipay-continuity/work-20261008/PRE_BATCH_B_MASTER_BACKUP.tar.gz` with SHA-256 `befbff33963088e56cd226a970e5d35cbcb606d9dd8f29b20f478e436185b6e0`.

Verified TwiPay API `MfaController` routes then corrected `apps/customer-ui` MFA settings to use real TOTP enrollment/confirmation, recovery regeneration and disable, preserving original modal shell; added recovery-code login to existing six-slot authenticator UI. Existing server-side session/CSRF/origin and legacy fail-closed finance behaviour remain unchanged. 3 new cross-layer source assertions added, Batch A/B suite **15/15 PASS**, 8 repo scans PASS. Actual frontend `tsc -b` could not run successfully without installed dependencies (missing modules, not a qualified build); no live Postgres/Redis or Playwright browser run. See `docs/migration/BATCH_B_MFA_SOURCE_CHECKPOINT_2026-10-08.md` for files/contracts/results.

**Next**: retrieve and verify developer GitHub HEAD/ZIP before claiming merge, then run real frontend typecheck/build and end-to-end MFA against the reconciled backend, then finish profile/KYC on that verified master. Never create an unrelated backend or redesign the ErhaPay UI. Do not claim Batch B complete until runtime checks pass.

## 2026-10-08 continued Batch B profile/KYC

Inspect `docs/handoff/MASTER_RECONCILIATION_2026-10-08.md` and `docs/migration/BATCH_B_PROFILE_KYC_IMPLEMENTATION_2026-10-08.md` FIRST; current working source and Git commits outrank earlier chat descriptions. Preserved ErhaPay profile and KYC source integration now has 22/22 static regression assertions passing; actual new developer backend merge and real browser tests remain BLOCKED. Never label Batch B fully qualified until those gates pass.

---

# LATEST APPEND-ONLY UPDATE — PHASE 6.2 PRE-DOWNLOAD AUDIT REMEDIATION (2026-10-09)

This update supersedes earlier Phase 6.1 next-task instructions. Continue from the **actual Git HEAD** in the latest `TWIPAY_PROVISIONAL_MASTER_CODE.zip` stored at `/Coov Technologies/`. Read `docs/phase6/PHASE_6_2_REMEDIATION_AND_PRODUCTION_ACTIVATION_2026-10-09.md` and the associated `docs/phase6/evidence/phase62-*` results. The single Git-backed master, ErhaPay UI, ledger, sessions, MFA, CSRF, KYC and default-off financial controls are retained.

Implemented: independent two-person financial tier review with evidence-bound verified BVN and validated caps, migration `0018_financial_tier_independent_approval`, updated restricted operations page; refreshed stale customer browser contracts; archived permanently excluded betting code outside the active source tree; added source/built-bundle exclusion checks and CI branch triggers. Supported offline tests: **449/449 passed**, repo scanners passed. Node 24 and genuine pnpm lockfile generation are still blocked in this runner by missing toolchain/network; database migration, browser E2E and production readiness are **NOT CERTIFIED**. Production financial execution hard-stops remain intact. Obtain independent runtime evidence and release approvals before enabling any provider or admission feature.
