# TwiPay Batch F — Evidence-Based Qualification

Generated: 2026-10-08T21:43:29.107Z
Git HEAD at execution: 5174c0ddd49acb670d47a75e2e8ad5803978ff26
Node: v22.16.0

**Status: NOT PRODUCTION QUALIFIED**

PASS 9 | FAIL 0 | BLOCKED 12

| Mandatory gate | Status |
|---|---|
| Batch A–F isolated source/unit tests | PASS |
| scripts/typescript-syntax-check.mjs | PASS |
| scripts/repository-security-check.mjs | PASS |
| scripts/architecture-check.mjs | PASS |
| scripts/financial-invariant-check.mjs | PASS |
| scripts/services-events-invariant-check.mjs | PASS |
| scripts/product-operations-invariant-check.mjs | PASS |
| scripts/production-hardening-invariant-check.mjs | PASS |
| scripts/git-history-secret-check.mjs | PASS |
| Node 24 toolchain | BLOCKED |
| pnpm package manager | BLOCKED |
| Pinned monorepo lockfile | BLOCKED |
| PostgreSQL 18 integration | BLOCKED |
| Redis 8 / BullMQ integration | BLOCKED |
| Customer Vite actual build | BLOCKED |
| API/Admin/Worker actual builds | BLOCKED |
| Authenticated Playwright + ErhaPay visual baseline | BLOCKED |
| Real PostgreSQL finance concurrency and maker-checker | BLOCKED |
| Real provider sandbox settlement and reconciliation | BLOCKED |
| Ticket QR UI and check-in across browsers | BLOCKED |
| Latest developer repository reconciliation | BLOCKED |

Blocked gates are not successful tests. TCP reachability alone does not prove a database or API is healthy.

## Source-test evidence
```text
# Subtest: ticket credential integrity is verified and reads are recorded without storing the secret
ok 104 - ticket credential integrity is verified and reads are recorded without storing the secret
  ---
  duration_ms: 0.27157
  type: 'test'
  ...
1..104
# tests 104
# suites 0
# pass 104
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 757.814733
```

## Required external qualification
- Obtain verified developer checkout, ADR 016–018, pinned dependency lockfile and Node 24; reconcile via Git, not overwrite.
- Restore PostgreSQL 18 and Redis 8, migrate disposable database, test concurrent holds, provider requery, event oversell, payout maker/checker and virtual-account provisioning.
- Run actual Vite/Nest/Next/worker builds, isolated Playwright customer/admin journeys across all eight requested viewports, compare screenshots against original ErhaPay UI.
- Execute payment provider sandbox flows and worker reconciliation with verified callbacks; use test-only credentials, never production funds.
- Add and verify an approved QR encoding library, customer viewer, staff scanner and repeated-check-in tests; keep event checkout and QR reveal disabled meanwhile.
- Remove or re-encrypt any legacy idempotency response blobs containing a ticket QR credential after a privileged, backed-up DB inventory.
- Inspect GDPR/NDPA and regulatory, privacy, provider and deployment requirements separately; do not assume a security source scan certifies production.
