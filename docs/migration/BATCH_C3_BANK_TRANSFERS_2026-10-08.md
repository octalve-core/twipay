# Batch C3 — Bank payout integration, 2026-10-08

Status: **SOURCE-INTEGRATED, NEVER PRODUCTION RELEASE-QUALIFIED**. Keep both API and UI sandbox switches `false`.

## Immutable source decisions

- This is the **existing TwiPay monorepo**, not a new backend or independently redesigned frontend.
- ErhaPay original four-step **Withdraw Funds** banking UI is reused (EnterAmount -> RecipientDetails -> ConfirmFundsWithdrawal -> Status); preserved styling/logo/assets. ErhaPay's separate **Transfer Funds** email-recipient feature has no backend contract and must remain inactive; never reinterpret user email as a bank account.
- All other future services deferred, betting permanently excluded. `events.refunds=false`, `operations.organizer_payouts=false` remain off.
- Original TwiPay API, ledger, wallet holds, provider registry, reconciliation, idempotency, worker, security and admin are retained.

## Evidence-based API contract and implementation

- `POST /v1/transfers/resolve-account` expects provider `paystack|monnify`, provider bank code, 10-digit account number, `NGN`; it returns masked account number and name. Browser must not invent beneficiary details.
- `POST /v1/transfers` expects those fields, decimal-free `amountMinor` string, 3–120-char narration, `Idempotency-Key`. Client also passes optional `expectedAccountName`; backend **freshly re-resolves** recipient and rejects changed names BEFORE creating a hold or contacting provider.
- ErhaPay `WithdrawFunds` confirmation now takes a user-visible explicit acknowledgement, no fake transaction PIN sent to the backend (no PIN endpoint exists), and only moves to Status from the genuine TwiPay response. Pending, `UNKNOWN` and `REQUIRES_ACTION` never appear as success. Status references `/receipt?txnId=<server reference>` but non-success documents are not presented as paid in C1.
- Exact naira/kobo conversion via existing `nairaToMinor` + `BigInt`, available balance checked in the client as guidance; backend `reserveWithTx` enforces actual available balance. Server returns no authoritative quote for fees, so UI clearly says that fees are **not quoted**. This is NOT release-complete fee handling.
- **Bank-directory API newly implemented**: `GET /v1/transfers/banks?provider=...` via the existing provider registry and typed payment-provider interface. Paystack official `GET /bank` Nigeria NGN cursor-pages, Monnify official OAuth-protected `GET /api/v1/banks`; both normalize and sort provider-specific bank codes/names. Server caches each provider response 10 minutes; client uses the provider's live list with NO guessed bank codes. Directory adapter still requires genuine sandbox contract testing before use. **Saved-beneficiary API and fee-quotation API do not exist**, so legacy saved-account actions remain inactive and no fee quote is fabricated. Names/account numbers are transient component state only.
- `apps/customer-ui/src/lib/api/dashboard-apis/transfers.ts` validates responses and stores ONLY the SHA-256 instruction digest, idempotency key, timestamp and optional server reference in `sessionStorage` across same-intent retries. Never stores raw beneficiary account or name there. Changing amount/recipient/provider requires explicit previous-attempt review and deliberate reset. UI rejects concurrent submit via ref lock; backend idempotency remains decisive.
- The existing `TransferService` retains transactional ledger reservation, verified provider evidence, hold release/capture, UNKNOWN status on uncertain outcome, **same-provider** `getPayout` requery and reversible ledger journal. No new unverified financial state machine, no provider fallback and no blind retry were introduced.
- Both the bank-resolution and payout-create endpoints now require server-side `BANK_TRANSFERS_SANDBOX_ENABLED=true` with `NODE_ENV !== production`, plus a Paystack `sk_test_...` key OR exactly `https://sandbox.monnify.com`. Client also requires `VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED=true`; both default OFF. Production can't enable payouts by flipping a UI flag. No actual sandbox keys were used.

## Verification

Executed in this isolated container: `node --experimental-strip-types --test docs/migration/test/*.test.mjs` => **59 / 59 PASS** (47 carried forward; 12 new C3 isolated/contract tests, including mocked Paystack and Monnify directory parsing); `node scripts/typescript-syntax-check.mjs` and repository security plus core invariant/static scanners PASS. These use Node v22 and installed `typescript` for isolated transpilation; no real Node24+pnpm dependency graph or PostgreSQL API runtime. See checkpoint logs.

### Mandatory unresolved qualification gates

1. Latest developer GitHub HEAD with ADR 016–018 remains inaccessible/unmerged. Reconcile through real Git diff and verify actual backend fixes; do NOT overwrite or re-create blindly.
2. Install exact pinned Node24/pnpm and a **real** lockfile; run full TypeScript typecheck, Vite+Next builds, tests, worker integration and visual parity of ErhaPay UI.
3. In isolated authorized sandbox, verify real `/transfers/resolve-account`, PostgreSQL holds/advisory locks, race conditions, double click, timeout/UNKNOWN, ledger journals, provider amounts/currency, same-provider requery, reversal and reconciliation using real provider sandbox evidence.
4. Add **enforced step-up MFA** (or other verified transaction authorization), transfer limits/fees/quote, server-side risk/velocity controls, provider bank-directory sandbox verification, beneficiary confirmation/audit and accessible pending/error UX. Do not enable production transfers until independently qualified.
5. Validate session cookies, CSRF, exact origin, BOLA/IDOR, account names, no PII browser storage, session expiry, responsive original visuals and screenshots in real browser.

Next vertical slice: **C4 virtual accounts**. Work continuously in the same source/commit history. Only one final consolidated delivery after all batches.
