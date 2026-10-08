# Task 06 — PostgreSQL migrations and financial concurrency qualification

Date: 2026-10-08. Status: SOURCE AUDIT/TEST PREPARATION ONLY — DATABASE QUALIFICATION BLOCKED.

## Source-of-truth and custody

Committed baseline: `1a3e123f6363ffc80ad2e4560f57120fa9c2e0b2` tagged `batch-04-handoff`. Preserve all uncommitted Batch 5 Tasks 1–5 work; no reset or migration rewrite. Task 5 preserved archive SHA-256 verified as `1c5ad6828668c5d7cc6d8bc8d260131d462df168286f27e32007766678879008`.

## Migration inventory and execution state

| Migration | Domain | Source review | PostgreSQL execution |
|---|---|---|---|
| `0001_identity_foundation` | Users, sessions, permissions, security events | Inspected | BLOCKED |
| `0002_financial_core` | Ledger, wallets/holds, financial instructions/provider transactions | Inspected | BLOCKED |
| `0003_services_events` | Utilities, events, checkout, tickets | Inspected | BLOCKED |
| `0004_product_operations` | Refunds/payouts, maker/checker, audit, feature flags | Inspected | BLOCKED |
| `0005_production_hardening_mfa` | MFA/session/recovery/security evidence | Inspected | BLOCKED |

**No migration has been executed in this Task 6 environment.** Source inspection is not migration proof. Any previously deployed migration must remain immutable absent a documented rollout plan; the uncommitted `0005` must be verified against existing deployments before adoption.

## Financial/database invariants — evidence boundaries

| Control | Evidence in source | Qualification status |
|---|---|---|
| Sealed balanced double-entry journals; cross-currency and late-append rejection | `0002_financial_core` and `financial-core.integration.test.mjs` | BLOCKED: DB runtime |
| Minor-unit BigInt, ledger-derived balance, locked wallet hold reservation | Ledger package and `WalletService.reserveWithTx` | BLOCKED: concurrent DB runtime |
| User-scoped idempotency, UNKNOWN/same-provider reconciliation and exact evidence | Batch 2–4 application contracts/tests | BLOCKED: integrated provider/DB runtime |
| Event-capacity serialization, ticket states, refund compensation and payout settlement | `0003`, `0004`, application/test sources | BLOCKED: DB runtime |
| Maker/checker, append-only audit, verified SKU mapping | `0004` and product operations test sources | BLOCKED: DB runtime |
| MFA recovery one-time use, timestep monotonicity, session terminal state | `0005` and production-hardening test source | BLOCKED: DB runtime |
| Transactional session/MFA checks on selected finance operations | Task 4 transactional helper | BLOCKED: revocation/role races |

This audit is a source/code review, **not** a complete semantic validation of all 1,815 SQL migration lines and not a claim of proven financial concurrency safety. Existing app services and migration triggers require actual PostgreSQL verification.

## Task 6 narrow changes

Added two adversarial real-database test definitions to `packages/database/test/production-hardening.integration.test.mjs`:

1. Eight competing conditional `mfaRecoveryCode.updateMany` redemptions must yield exactly one successful mutation.
2. Eight competing conditional session-rotation claims must yield exactly one successful ACTIVE → REVOKED mutation.

These test **the atomic claim primitives**, not the full MFA/session API flows. They are prepared but have **not run** against PostgreSQL. No money/ledger/provider source logic was modified; no migration was edited.

## Commands / executed evidence

- `sha256sum` on Task 5 preserved archive — PASS (matches recorded checksum).
- `git rev-parse HEAD`, `git tag --points-at HEAD`, `git status --short` — PASS for custody/reference; WIP remains uncommitted.
- `node --check packages/database/test/production-hardening.integration.test.mjs` — PASS (syntax only).
- `node scripts/typescript-syntax-check.mjs` — PASS (127 TS files).
- `node scripts/repository-security-check.mjs` — PASS (329 text files after docs/test changes).
- `node scripts/architecture-check.mjs` — PASS.
- `node scripts/financial-invariant-check.mjs` — PASS.
- `node scripts/services-events-invariant-check.mjs` — PASS.
- `node scripts/product-operations-invariant-check.mjs` — PASS.
- `node scripts/production-hardening-invariant-check.mjs` — PASS.
- `node scripts/git-history-secret-check.mjs` — PASS (reachable history).

## BLOCKED and risks

- Host Node `v22.16.0`, required Node 24 absent; pnpm, Prisma deps, `psql`, Docker, Redis absent. No fabricated lockfile or tooling.
- No new database creation, migration deployment, Prisma validation, PostgreSQL 18 concurrency, transaction rollback, financial race, API E2E, staging or provider execution passed.
- Existing DB integration tests use real Prisma/Postgres and may expose fixture/environment defects once run; those have not been pre-emptively suppressed.
- Task 4 role-change/deactivation transactional ordering, row-lock acquisition, deadlocks and session-guard windows remain unresolved.
- Direct database session/MFA tests do not prove rate-limit or browser CSRF semantics.
- High-risk features remain unqualified; do not enable `events.refunds` or `operations.organizer_payouts`.

## Next actions on PC/staging

Install Node 24, real pinned pnpm and genuine dependencies/lockfile. Start disposable PostgreSQL 18 and Redis. Apply each migration to a new DB; verify upgrade path and Prisma schema, execute `pnpm --filter @twipay/database test`, run concurrent wallet spends/holds, event checkout, refunds/payouts and session/MFA races against the actual API and worker, then perform rollback/recovery. Run staging and provider checks separately. Record exact exit codes/logs; fail-closed until qualified.
