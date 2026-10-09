# TwiPay — Phase 4 / Batch 4.1: Financial Eligibility and Transaction-PIN Authorization

**Date:** 2026-10-09 (Africa/Lagos)  
**Base:** `bf5683ee35eea2a2ef45a2f76ed4910b07d05428` — same Git master, same branch `phase3/low-friction-contact-20261009`.  
**Status:** source implementation and mocked tests only. **NOT RELEASE-QUALIFIED.**

## Purpose and deliberate limits

Add independent server-side checks before covered financial intents, wallet holds and provider submissions. Preserve original ErhaPay-derived `apps/customer-ui`, the ledger, idempotency, transaction states, reconciliation, all provider/sandbox hard-stops, admin RBAC, and the existing signup flow. This is the **first** Phase 4 batch, not the completion of transfers, fees, beneficiaries, wallet funding, utility sales, or events. The financial customer UI is not switched on, and the original assets have not changed.

## Implemented security boundary

- Added `FinancialAuthorizationService` as a singleton injectable through existing FinanceModule and its importing ServicesModule/EventsModule. The existing session/CSRF/Origin guards still run first. Customer-facing covered routes require a **strict four-digit `transactionPin` body field** (never a `pinVerified` boolean): `POST /v1/transfers`, `POST /v1/payments/collections`, `POST /v1/virtual-accounts`, `POST /v1/services/purchases`, and `POST /v1/events/checkout`.
- Eligibility is checked from the **database**, not frontend state: active owner account; verified email or phone; active, unexpired, non-idle owner session; enrolled MFA with recent session assurance; provider-verified BVN; independently approved financial eligibility tier; positive max-per-intent and daily debit limits; actual requested minor-unit amount; Argon2id PIN verification with the Phase 3.4 independent PIN pepper. No provider KYC response automatically promotes a customer's financial tier.
- New additive `0011_financial_eligibility_default_deny` migration creates `financial_eligibility_policies` with default `PENDING` status, KYC tier 0 and zero limits; no backfill or approval endpoint. `APPROVED` requires explicit nonzero tier/limits and timestamp by database constraint. These numeric tier labels are **internal placeholders only**, not claims of banking/regulatory approval. A compliant manual/maker-checker promotion workflow and regulatory limit mapping are **not** in Batch 4.1.
- PIN guesses are serialized by locking the user row inside a transaction, stored failure counters and 30-minute lockouts apply after five incorrect entries, and security events record the action but never the PIN. Transaction PIN remains distinct from MFA. Public input and server-issued authorization context are never included in idempotency request hashes or provider payloads.
- A short-lived **server-only** authorization artifact is bound to user ID, session ID, intent kind, exact amount and PIN credential `changedAt`. At the actual debit transaction, policy, verified contact, KYC, MFA, limits, locked PIN and live session are **rechecked under database row locks** before any hold/ledger debit. This serializes same-user debits for the UTC-day spending cap. Daily total is SQL-aggregated across in-flight/unknown/succeeded debits and recorded fees; failed/cancelled/reversed debits are excluded.
- Event checkout authorizes the quote and then rechecks the **actual calculated price plus platform fee** inside its settlement transaction. Transfers/bills recheck before reserve. Wallet collection rechecks before creation of its provider operation. Virtual-account provisioning rechecks before its provider work. All existing provider and feature flags **remain OFF**, and a second `FINANCIAL_AUTHORIZATION_SANDBOX_ENABLED=false` switch fails closed even if another flag is mistakenly enabled. Production is hard-blocked regardless of environment flag.

## Qualification and outstanding gaps

- **PASS:** 308/308 available offline source and mock-behavior tests, including 12 new Batch 4.1 tests; TS syntax scanner; repository security and architecture checks; ledger/financial, services/events, operations and production-hardening invariants; ErhaPay design inventory (123 original assets, zero material changes). No real money moved.
- **BLOCKED:** Node 24 frozen pnpm dependency installation/semantic TypeScript compile, PostgreSQL 18 migration/row-lock/aggregate/concurrency, Redis 8, actual Fastify CSRF/session/MFA, provider sandboxes, browser purchase flows, customer PIN modal and live payment delivery/reconciliation. Preflight: 5 PASS / 0 FAIL / 9 BLOCKED. Browser customer purchase flows are intentionally left inactive and must be wired to the original ErhaPay design after the provider/fee contracts have been qualified.
- **NOT IMPLEMENTED:** verified fiat limits corresponding to specific regulated KYC tiers, risk-policy maker/checker approval, rolling/card/funding velocity controls, bank-transfer fees and fee quotation, beneficiary CRUD, customer checkout PIN confirmation screens, exact limits including all future fees, immutable user-scoped PIN-intent nonce with cross-device consumption, fraud analytics, background payout authorization changes and provider production activation. New tier/limits must not be manually promoted to live without independently approved regulatory and compliance policy.
- The existing source's wallet ledger, idempotency, reconciliation, and default-off controls were **not rewritten**. These remain subject to their independent runtime tests.

## Evidence and next batch

- `docs/phase4/test/batch-41-financial-authorization.test.mjs`: actual transpiled service behavior with an isolated transaction stub; no real PostgreSQL claim.
- `docs/phase4/evidence/batch-41-offline-tests-2026-10-09.txt`: complete consolidated offline test output.
- `docs/phase4/evidence/batch-41-runtime-preflight-2026-10-09.txt`: exact environment obstacles.

**Next:** Phase 4.2: authoritative bank fee + transfer quote, beneficiaries and customer PIN confirmation within the original ErhaPay UI, against the new default-deny authorization service. Integrate cross-service risk and account states with maker/checker, then qualify with a disposable PostgreSQL 18 cluster, Node 24, Redis 8, browser tests and actual provider sandbox credentials. Do not infer readiness from this source checkpoint.
