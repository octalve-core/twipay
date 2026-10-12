# TwiPay Phase 4, Batch 4.5 — Utility Purchase Confirmation & Reconciliation

**Date:** 2026-10-09, Africa/Lagos  
**Starting Git HEAD:** `81dedd26e36d29cf77f0bdf03e85dd68860a8b90`  
**Status:** source implementation and dependency-light/offline security verification only. **NOT Node 24, PostgreSQL 18, provider, browser or production qualified.**

## Scope and continuity

Same original Git-backed TwiPay master. `apps/customer-ui` remains the original ErhaPay-derived interface. `apps/web` remains a reference, not an alternative customer deployment. Original navigation, typography, visual assets, financial ledger, immutable journal, idempotency, KYC/contact/MFA/PIN/CSRF/sessions and feature hard-stops are unchanged.

### What was implemented

1. The original ErhaPay airtime/data/electricity/cable purchase component now requires a real four-digit transaction PIN at final confirmation. The PIN stays in transient React state, is transmitted only in the protected purchase body, is cleared on success/error/navigation, and is never stored with the browser's tab-local idempotency/retry marker.
2. `POST /v1/services/quotes` issues five-minute signed quotes after matching an active NGN product, provider offer and a **user-owned, valid, unexpired** provider-validation record. The quote binds customer, product and offer IDs, recipient fingerprint, validation ID, product/price snapshot, exact purchase amount, explicitly configured fee and total debit. This does not claim a live upstream provider price query; the underlying catalogue must itself be independently qualified.
3. `POST /v1/services/purchases` now requires the signed quote, customer PIN, validation ID and idempotency key. TwiPay verifies the quote and obtains **total debit** before the financial authorization check. Inside the existing PostgreSQL transaction, it rechecks active product/offer, catalogue terms, validation expiry and quote expiry, plus financial eligibility and exact debit, **before opening the hold or submitting to a provider**.
4. Additive Prisma migration `0014_bill_purchase_signed_quotes` adds a nullable, unique `approvalQuoteId` for existing-history compatibility, and the original SQL update trigger is extended to keep that new instruction field immutable. Different idempotency keys cannot successfully consume the same quote once the unique database constraint is enforced. The original SQL state machine is preserved exactly rather than rewritten.
5. **No invented customer fees.** The quote requires an independent `BILL_QUOTE_HMAC_KEY`, `BILL_FEE_POLICY_SANDBOX_APPROVED=true` and explicit `BILL_CUSTOMER_FEE_MINOR=0`. Nonzero fees are deliberately blocked until independently approved, priced and balanced in the fee ledger. Production quote issuance is hard-stopped. These config flags remain **OFF**. No financial service was activated.
6. The existing bounded, same-provider reconciliation remains: `UNKNOWN` and ambiguous provider outcomes retain holds for review instead of guessing failure/success; verified failure releases a hold, verified fulfillment captures it, verified reversal creates compensating journal entries. Batch 4.5 adds a correlation check inside provider result settlement: financial instruction, account owner, provider operation type, merchant reference and the originally selected provider offer must agree before touching the ledger. Contradictions create a `NEEDS_REVIEW` case; existing terminal ledger entries are not rewritten.
7. The existing ErhaPay status page reads owner-scoped purchase records and never assumes payment success from the submit button. The submitted intent is recovered with its same idempotency marker, not an automatic new debit.

### Actual tests and evidence

- **364/364** dependency-light tests passed (14 new Batch 4.5 tests, older sandbox-route contract updated to include `/quotes`); no failures.
- Executed quote issuance/validation, tampering, expiry and pricing policy via actual TypeScript code under mocked Nest exception seams. Executed actual `BillService.quotePurchase`, `totalDebitForQuote` and `applyProviderResult` using mocked DB/provider seams. These are not database concurrency or provider proofs.
- Source scans passed: TypeScript **syntax only**, repository security, architecture, finance, services/events, product operations, production hardening, deterministic ErhaPay design inventory. All **123 original graphic assets** remain materially unchanged; 66 route paths.
- Preflight **5 PASS, 0 FAIL, 9 BLOCKED**: Node 24, exact pnpm, lockfile, frozen install, PG18/Prisma migration, Redis8/worker, Docker, full builds and integration tests unavailable. See `docs/phase4/evidence/batch-45-offline-regression-2026-10-09.txt` and `batch-45-runtime-preflight-2026-10-09.txt`.
- **Not run:** full TypeScript semantic typecheck, real Prisma migration, concurrent duplicate-quote consumption, provider validation and live price fidelity, PIN/MFA/CSRF HTTP E2E, VTpass/Monnify sandbox purchase/requery/error/duplicate delivery, reversals/journal accounting, UI browser screenshots and responsive comparison. No live money movement or product flag activation.

### Mandatory release qualification

Use an authorized disposable Node 24/pnpm 12.9.1, PostgreSQL 18, Redis 8 environment with a genuine committed frozen lockfile. Deploy migration 0014 to a disposable database. Verify the quote uniqueness constraint under two concurrent independent keys, expiry during database contention, stale catalogue/provider offers, invalid provider validation, wrong KYC/MFA/PIN, HTTP CSRF, provider timeouts and mismatched status/amount/currency/request reference. Prove same-provider reconciliation under duplicated webhooks, a failed provider call, uncertain submission, provider reversal and crash recovery, and balanced journals/holds in each case. Independently approve provider catalogue pricing and any nonzero customer fees **before** enabling even a sandbox purchase. Conduct actual React/ErhaPay browser accessibility and visual parity tests. **Do not enable financial or provider flags until all applicable release gates pass.**

### Reproduction

```bash
node --experimental-strip-types --test docs/phase4/test/batch-45-bill-quotes.test.mjs
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

**Next:** Phase 4.6 deeper cross-provider financial exception, approval and reconciliation handling (only where grounded in existing contracts), then Phase 5 events/support/admin and Phase 6 real runtime/provider/browser release qualification. Continue the same master; do not remerge old archives or promote source tests into production certification.
