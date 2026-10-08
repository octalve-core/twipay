# TwiPay — Phase 1 / Batches 1.1 and 1.2

**Status: SOURCE RECONCILIATION IMPLEMENTED; RUNTIME VERIFICATION PENDING.**

## Immutable source provenance

Checksummed, read-only copies of the source archives have been placed in the isolated release-audit workspace; the hashes allow integrity verification. See `docs/integration/PHASE1_SOURCE_RECONCILIATION.json` for archive SHA-256 and all conflict decisions. **Do not** add original ErhaPay archives, developer-export local credentials, or obsolete source snapshots to production container images. Original archives are not Git commits.

Starting integrated master: `7868046893addc4bfa9384b19f474eb3428350ad`, branch `integration/phase1-developer-runtime-20261008`. The developer's `twipay-master.zip` has no `.git`, therefore this is a source reconciliation, **not** a Git ancestry-based three-way merge.

File comparison (excluding `.git` and generated directories): **300 identical shared files, 48 changed shared files, 11 developer-only files, 523 master-only files**. The source-decision log records why 30 overlapping paths received selected developer changes and 18 retained later master changes.

The original ErhaPay app is the **customer UI authority**; all original file paths remain present under `apps/customer-ui`. New pages must reuse ErhaPay components, tokens, navigation and responsive patterns, and be approved with real-browser visual comparison. The simplified `apps/web` is legacy/reference only. Betting is permanently out of TwiPay product scope; legacy source still exists for preservation and must be excluded from any production bundle during Phase 2. Deferred services remain inactive.

## Developer runtime changes incorporated

- Prisma 7 `PrismaPg` driver adapter in API, with **required `DATABASE_URL`** and no hardcoded password fallback.
- Prisma 7 datasource moved out of `schema.prisma` to `packages/database/prisma.config.ts`, using `process.env.DATABASE_URL ?? ''`; generation need not have a DB URL, migrations must be supplied one. **No fallback database password**.
- Prisma adapter/pg dependencies incorporated into API/database packages; worker ioredis/runtime typing dependencies incorporated, preserving all later workspace dependencies.
- Database fixture adapters and collision-resistant per-run fixture hashes; Vitest conversions where the developer had verified runner compatibility.
- API/worker build declaration and decorator options; narrowly scoped admin/legacy-web TypeScript corrections.
- Container host-port isolation (`127.0.0.1:5435` PostgreSQL and `127.0.0.1:6382` Redis); local Docker development password remains local-only and must never be reused beyond local isolated setup.
- Git-aware `.env` scanner and generated-directory exclusion; history-secret scan still required.
- Developer ADRs 016–018 preserved. Developer task-journal files remain only in the checksummed source snapshot and are not shipped in our merged code; review/redact any development credentials before separately publishing them.

## Changes deliberately NOT imported

The developer's older event service returned `qrPayload` in checkout responses and lacked later quote/idempotency redaction. Its older finance/controllers/provider code lacked later transfer name rechecks, bank directory, virtual-account status, feature gates, utility validations and ticket credential isolation. These **remain our newer master implementations**. All financial features and QR access remain default-off.

Developer `pnpm-lock.yaml` has **only the root `.` importer**, not `apps/api`, `apps/worker`, `apps/admin`, or `apps/customer-ui`; thus it cannot pass a frozen full-workspace dependency install. Its original bytes are preserved in `docs/integration/developer-export-lockfile.reference.yaml`, **not** installed as `pnpm-lock.yaml`. A new genuine lockfile MUST be generated using pinned Node 24/pnpm and verified via frozen clean install in Phase 1.3–1.4. Do not manufacture a lockfile.

## Required next gates (all BLOCKED here)

1. Node 24 and pnpm 12.9.1 available; regenerate genuine complete `pnpm-lock.yaml`, `pnpm install --frozen-lockfile` from clean checkout, validate lockfile importer coverage.
2. Prisma 7 generate/validate/migrate deploy on **isolated** PostgreSQL 18; exercise DB tests, concurrency, holds, idempotency and provider-operation state.
3. Redis 8/BullMQ worker startup/shutdown/reconciliation; no job execution against live providers.
4. Clean API, worker, admin, preserved Vite customer app builds, strict typechecks, full workspace test suites, CI.
5. Browser auth/MFA/KYC and ErhaPay visual parity; 8 responsive viewports; inspect CSRF concurrent mutations.
6. Verify six sandbox flags all false unless isolated, approved and tested; no money movement or ticket issuing in production.
7. Compare with developer's actual branch/commit if later available; a GitHub ZIP is not the full developer history. Do not push or overwrite remote without review.

## Added requirements approved by product owner — NOT implemented yet

**Google login (Phase 3):** authorization-code OIDC with PKCE, state, nonce, strict redirects, server-side callbacks and opaque TwiPay sessions. Protect new/existing account linking by verified identity and authenticated recent step-up; no Firebase or long-lived browser access/refresh tokens. Login must not silently link two accounts based solely on an unverified email claim. Implement abuse tests and logout/session rotation.

**Mandatory transaction PIN (Phases 3 and 4):** server-enforced 6-digit PIN policy (exact length subject to final approved risk policy), enrollment with recent MFA, Argon2id with server-side pepper and KMS-backed rotation policy; no PIN in logs or browser storage. Throttle/lock attempts, authenticate transaction intent/recipient/amount server-side, require reauthentication for reset/recovery and never use PIN as a substitute for MFA. PIN verification must occur before financial holds or outbound provider submission. Add dual-factor and concurrency/duplicate attempt tests. **Not added to endpoints yet; no false claim of transaction PIN protection.**

## No silent security downgrades

- Keep immutable double-entry ledger and ledger-derived balances.
- Preserve idempotency, holds and unknown-provider-outcome reconciliation.
- Preserve owner-scoped authorization, exact-origin/CSRF protections, non-cacheable ticket credentials and MFA step-up.
- Preserve `events.refunds=false`, `operations.organizer_payouts=false` and all newly introduced sandbox gates.
- Never treat source scanners as a substitute for actual runtime security tests.
