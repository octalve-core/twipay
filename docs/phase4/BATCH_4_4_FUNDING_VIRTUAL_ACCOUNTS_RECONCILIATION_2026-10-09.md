# TwiPay — Phase 4, Batch 4.4: Funding, Virtual Accounts & Reconciliation

**Date:** 2026-10-09 (Africa/Lagos)  
**Authoritative base:** `539940916ca32c5bffbac4cf941a00388f72131d` / `phase3/low-friction-contact-20261009`  
**Status:** SOURCE IMPLEMENTATION WITH OFFLINE TEST EVIDENCE; NOT production-, provider-, database- or browser-qualified.

## Scope and source-of-truth decisions

This is an incremental change in the original Git-backed TwiPay monorepo. The existing ErhaPay-derived `apps/customer-ui` remains authoritative; `apps/web` is still only a reference. The immutable ledger, settlement/reversal logic, PostgreSQL advisory locks, idempotency, session MFA, CSRF, KYC and financial PIN controls, and all default-off flags remain in effect. No artificial balances, fees or provider transactions were created. No real payments were made.

### Delivered

1. **ErhaPay add-funds flow now sends the actual backend-required four-digit transaction PIN.** The customer sees their selected provider and amount, explicitly confirms the payment attempt, and enters the PIN in a protected input. The PIN is passed only in the financial request, is cleared on success or failure, and is not written to browser retry/reference storage. The API independently reauthorizes the real session, verified contact, approved financial tier, BVN, recent MFA, PIN, lockouts, amount and sandbox configuration before any collection record or provider request.
2. **Original virtual-account creation form now supplies the mandatory PIN,** in addition to the existing BVN, consent and (Paystack) validation bank information. No raw BVN, NIN, validation account number or PIN is persisted by the client-side intent retry store. Existing owner-scoped listing remains intact, and `PENDING`/`UNKNOWN` assignments are never treated as active accounts.
3. **Funding return and checkout screens only show authoritative status from the owner-scoped `GET /v1/transactions/:reference`.** A provider redirect never proves wallet credit. A short-lived API-issued reference is retained in tab-scoped session storage only for read-only status lookup, not authorization or money movement. Internal CREATED/AUTHORIZED/FUNDS_RESERVED/PROVIDER_SUBMITTED states map to safe pending/processing language. Missing, other-owner or malformed responses remain unconfirmed. Status refresh never reissues collection or requery-to-credit from the browser.
4. **Virtual-account webhook deposit routing fails closed** if the provider-supplied account reference and account number point to different users/accounts, a supplied identifier is unknown, the assignment is inactive, or the currency/provider disagrees with TwiPay's active NGN record. Each identifier is checked independently; there is no quiet fallback from a conflicting reference to a known number. Contradictions open a review case without crediting a wallet.
5. **Deposit settlement rechecks the selected account inside the database transaction** using a PostgreSQL `FOR UPDATE` row lock before user wallet creation and immutable balanced journal posting. Changes to owner, account reference/fingerprint, provider, status or currency prevent wallet credit and create a reconciliation review case. Existing provider server-side status/amount/currency verification, duplicate-event advisory lock, financial journal and idempotency behavior are retained.
6. Unknown collection-initiation responses now include the original requested amount and currency for safe, accurate customer review; UNKNOWN remains UNKNOWN and no client/server path marks it paid without independent settlement evidence.

### Tests and limitations

- **PASS:** `node --experimental-strip-types --test $(find docs scripts -name '*.test.mjs' | sort)` — **350 passed, 0 failed**. This includes **17 new Batch 4.4 tests** (actual TypeScript destination helper and mocked PaymentService execution, malformed/locked account routing, PIN-required funding request and status checks). Older source tests were updated only where the previous PIN-less contract or outdated wording was superseded.
- **PASS:** TypeScript source syntax check (476 source files); repository security, architecture, financial, services/events, operations, production hardening checks; original ErhaPay design inventory. All **123 original visual image assets preserved without material change**, and the same 66 route paths remain.
- **NOT RUN:** full Node 24 semantic typecheck/build and pnpm frozen install (Node 22 available; pnpm and authentic lockfile absent), Prisma 7 generation/migrations on PostgreSQL 18, PG row-lock/deposit-credit concurrency, Redis 8/BullMQ, real signed Paystack/Monnify webhook and requery sandbox scenarios, actual email delivery, browser/Playwright parity, real MFA/CSRF/PIN HTTP E2E. These must be executed on the qualified developer runner before financial feature activation.
- **Important provider caveat:** Monnify/Paystack webhook payload versions can differ. New strict deposit routing may intentionally route legitimate but ambiguous provider payloads to manual reconciliation rather than guessing an owner; approved sandbox payload fixtures and account-assignment correlation remain required before activation. No wallet or provider feature flag was enabled.

### Reproducible offline verification

```bash
node --experimental-strip-types --test docs/phase4/test/batch-44-funding-reconciliation.test.mjs
node --experimental-strip-types --test $(find docs scripts -name '*.test.mjs' | sort)
node scripts/typescript-syntax-check.mjs
node scripts/repository-security-check.mjs
node scripts/architecture-check.mjs
node scripts/financial-invariant-check.mjs
node scripts/services-events-invariant-check.mjs
node scripts/product-operations-invariant-check.mjs
node scripts/production-hardening-invariant-check.mjs
node scripts/design/erhapay-ui-inventory.mjs --check
```

Evidence: `docs/phase4/evidence/batch-44-*.txt` and read-only runtime preflight JSON. Provider-specific completion, reversal conservation, account assignment ambiguity, genuine replay and database lock races are still release blockers, not accomplished tests.

### Next engineering priority

Continue Phase 4 with utilities financial confirmation/reconciliation and operator review workflows, then Phase 5 events/support/admin and mandatory Phase 6 full infrastructure/browser/provider release qualification. For virtual-account deposits specifically, add provider-verified account identifiers and unambiguous assignment correlation in each signed provider adapter; execute real concurrency tests for duplicate credits, deactivated accounts, partial failures and reversal journals. Require independent financial eligibility, explicit provider fees and approval before production activation.
