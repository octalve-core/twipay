# TwiPay Phase 4 / Batch 4.6 — Financial Exception Management

**Date:** 2026-10-09 Africa/Lagos. **Starting HEAD:** `474cb260bb35141d31723906631266e28a9875ce`.

**Qualification classification: SOURCE IMPLEMENTATION ONLY.** This work does **not** imply a live financial provider, real PostgreSQL, Redis, Node 24, UI/browser, or operational release qualification.

## Intent and bounded implementation

The existing financial flows already retain uncertain provider outcomes, wallet holds, reconciliation cases, per-provider operations, and compensating journal contracts. Batch 4.6 introduces the missing **restricted operational triage and evidence-review workflow** without duplicating a payment engine or enabling provider flags.

1. Add read-only `GET /v1/operations/financial-exceptions` with an ordered, bounded queue (up to 100 open cases and 100 active holds). It returns masked/safe operational fields only, never upstream raw provider payloads, complete account identifiers, encrypted evidence, or customer PII. It intentionally exposes all active holds and unknown transaction states for review **without inventing a timeout to auto-release money**.
2. `POST /v1/operations/financial-exceptions/:caseId/prepare` stores a maker's review note and time and creates an auditable preparation event. Requires a dedicated permission, MFA step-up and independently revalidated active session inside the database transaction. Uses a row lock to prevent concurrent overwrite.
3. `POST /v1/operations/financial-exceptions/:caseId/close-verified-status` requires an **independent** checker, dedicated approval permission, MFA step-up, active session, an existing prepared review, linked matching terminal provider/financial statuses, no active hold, and a posted journal for succeeded/reversed transactions. Only `PROVIDER_STATUS_MISMATCH` cases can be closed under this narrow contract. An unresolved, duplicated, missing, amount/ledger/fulfillment/refund/settlement discrepancy remains open for specialist reconciliation.
4. In the database transaction, obtain financial and provider row locks **before** the reconciliation-case lock, recheck linkage and latest statuses, and store an audited `MATCHED_TERMINAL_STATUS_ONLY` resolution. These actions **never** set provider or transaction success/failure, adjust a balance, capture/release a hold, post a journal, create a refund, or submit to a provider. This is documentation of evidence already reconciled, NOT a financial repair tool.
5. Add migration `0015_financial_exception_review` with nullable historical-compatible reviewer fields, immutable prepared/approved review evidence, independent checker constraint, and separate `ops.reconciliation.{read,prepare,approve}` permissions assigned to existing roles without creating any privileged users.
6. Add an `/exceptions` page to the pre-existing separate `apps/admin` application using the current operations shell/style; no customer ErhaPay UI or navigation changes.

## Actual source-level results

- **372/372 dependency-light offline tests passed, 0 failed**, including 8 Batch 4.6 service/contract tests using compiled TypeScript against mocked database seams.
- TypeScript syntax, repository security, architecture, financial, services/events, operations, hardening and original ErhaPay inventory checks passed. The UI asset inventory confirms 123 original assets with no material changes and 66 customer routes.
- Runtime preflight: **5 PASS, 0 FAIL, 9 BLOCKED** (Node 22 rather than Node 24, no pinned pnpm or lockfile, no real PostgreSQL 18, Redis 8, Docker, provider sandbox or full build).
- Mocked transactions **do not prove PostgreSQL row-lock or maker/checker concurrency**. The migration and row locks still require real deployment and contention tests.

## Security and release gates

- **Nothing auto-resolves UNKNOWN.** Stale transaction age is not a proof of failure, and manual review cannot remove wallet holds.
- Provider/currency/reference evidence and live reconciliation remain the responsibility of original provider-specific services. Manual checker closure is deliberately limited to evidence-consistent terminal status cases, not discrepancies requiring financial movement or external confirmation.
- This review **does not build** a universal reversal execution engine or automated stale-hold release. Those actions require independently qualified provider evidence, maker/checker and real double-entry accounting; they remain disabled/unsupported.
- Review notes must not contain secrets, bank account numbers or identity numbers. All customer/provider raw evidence must be handled through approved secure channels.
- Existing financial services, provider config/flags, idempotency, ledgers, original migration hashes and original 123 ErhaPay design assets are untouched.
- Node 24/pnpm frozen lockfile, migration 0015 deployment on disposable PostgreSQL 18, lock contention tests on **independent connections**, Redis 8/worker, HTTP RBAC/MFA/CSRF E2E, real provider status reversal tests, and administrator browser tests remain **BLOCKED/NOT EXECUTED**. Do not enable providers before Phase 6 qualification.

## Reproduction

```bash
node --test docs/phase4/test/batch-46-financial-exceptions.test.mjs
node --experimental-strip-types --test $(find docs scripts -name '*.test.mjs' | sort)
node scripts/typescript-syntax-check.mjs
node scripts/repository-security-check.mjs
node scripts/architecture-check.mjs
node scripts/financial-invariant-check.mjs
node scripts/services-events-invariant-check.mjs
node scripts/product-operations-invariant-check.mjs
node scripts/production-hardening-invariant-check.mjs
node scripts/design/erhapay-ui-inventory.mjs --check
node scripts/qualification/phase1-3-preflight.mjs
```

**Next:** Phase 5 — event organizer/ticket experience, support, notifications, RBAC admin completion — while preserving deferred Phase 6 runtime qualification. Never count offline mocks as database concurrency proof or provider settlement evidence.
