# TwiPay — Phase 4 / Batch 4.3 Saved Recipients, Transfer Confirmation and Status

**Date:** 2026-10-09 (Africa/Lagos)  
**Base Git HEAD:** `dea58e8808584ef5ec0f2ac39a4619777d1a9306`  
**Status:** Source-implemented, offline-tested; **NOT** browser/database/provider-qualified, and **NOT** production ready.

## Authority and exclusions

Continue the original Git-backed monorepo and ErhaPay-derived React/Vite UI. No redesign or remerge, no live transfers, no automatic payout retries, no live release gates altered. Existing financial eligibility (verified contact, independent approved KYC financial tier and BVN, recent MFA, active session, genuine PIN, limits), wallets, ledger/holds, transactional idempotency and provider reconciliation remain authoritative. No inferred bank fees or risk thresholds.

## Delivered

1. **Saved-recipient provider provenance:** additive migration `0013_saved_beneficiary_provider_provenance` adds nullable `beneficiaries.providerCode`. Only accounts saved or re-verified through a known sandbox provider receive a code. Existing saved rows remain NULL/legacy and are **not** silently eligible for provider-specific shortcuts. List responses expose provider and masked number, never account ciphertext.
2. **Server-only account material:** `savedTransferDestination(userId, id)` enforces user ownership, `saved=true`, not archived, NGN, approved provider provenance and a consistency check of decrypted account number, last four digits and existing fingerprint. Full 10-digit saved account numbers are not sent to browser transfer APIs.
3. **Dedicated saved-recipient instructions:** `POST /v1/transfers/beneficiaries/:id/quote` and `POST /v1/transfers/beneficiaries/:id/transfer` both operate on the authenticated customer and owner-scoped recipient. The existing sandbox hard stops apply; bank resolution still occurs before quotes and again before provider payout. Signed quote binds beneficiary UUID in addition to customer, provider, fingerprint, name, bank code, amount, narration, fee, total and expiration. Direct-account and saved-account quotes cannot be interchanged.
4. **Debit-transaction recheck:** Financial policy/session/PIN recheck runs before row-locking the saved recipient, preserving the established financial lock order. An SQL row lock then ensures the selected saved recipient is still active, unchanged, owner-scoped and associated with the same provider and account fingerprint before the immutable financial transaction and hold. Archive/edit contention and quote replay **still require real PostgreSQL concurrency testing**.
5. **ErhaPay customer transfer experience:** Choose a saved, provider-proven recipient in the existing bank-recipient step, or enter a new account manually. Both converge on the original quote/fee/total preview, PIN and explicit confirmation. Saved-recipient submission references only an ID from the browser. There is no new UI framework or onboarding wizard.
6. **Honest pending statuses:** If provider payout execution results in an unknown outcome, the API returns the known quote amount/fee/total and masked recipient with UNKNOWN status; existing wallet hold remains, with a reconciliation case. The customer status screen provides an explicit read-only refresh from the owner-scoped `/v1/transactions/:reference`. Refresh **does not** resubmit or settle a payout; the customer must review previous attempts rather than create duplicates.
7. **Risk:** Existing financial limits, MFA/PIN lockout, quote identity, idempotency and default-off provider gates apply equally to saved transfers. No new numerical velocity/fraud thresholds were invented or activated without product/operations approval.

## Tests and evidence

- `docs/phase4/test/batch-43-saved-transfers.test.mjs`: 11 passed, 0 failed; actual signed quote code plus mocked saved-recipient service, owner, integrity, provider, masking, mismatch and source boundary tests.
- Consolidated dependency-light suite: **341 passed, 0 failed**, `docs/phase4/evidence/batch-43-offline-regression-2026-10-09.txt`.
- Source TypeScript **syntax** check, repository security, architecture, ledger/financial, services/events, operations, production hardening, deterministic ErhaPay inventory: PASS. 123 original ErhaPay assets preserved (69 exact byte matches, 54 line-ending-only).
- Runtime preflight: 5 PASS, 0 FAIL, 9 BLOCKED (Node 22 available; Node 24, pnpm 12.9.1, lockfile, Docker, PG18, Redis8 and real build unavailable). Runtime test results must not be inferred from source tests.
- Additional Vitest suites under `apps/api/test` and `apps/worker/test` cannot execute without project dependencies; the legacy simplified `apps/web` contains an unrelated preexisting expected-copy assertion failure and is not the customer UI authority. Those suites were not counted as passing.

## Required release qualification and future work

- Node 24 and pinned pnpm with reviewed authentic lockfile; real Prisma 7 generate and PostgreSQL 18 migrate (including new nullable providerCode column); Redis 8/BullMQ integration.
- Real HTTP/CSRF/MFA/PIN/saved-ownership E2E, multi-connection PostgreSQL archive/quote/hold contention, session-revoke races, provider resolution/name changes, full payout and reversal ledger conservation and unknown-outcome recovery, actual original ErhaPay mobile/desktop browser parity.
- Approved provider-specific fees, operations-controlled risk thresholds and release gates; do not activate any money moving features before external and internal signoff.
- Phase 4.4: wallet funding/virtual account user experience and deeper financial reconciliation; Phase 5 events/support/admin; Phase 6 release qualification. Do not promise provider success or mark UNKNOWN as SUCCEEDED.
