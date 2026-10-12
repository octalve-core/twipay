# TwiPay Phase 5 / Batch 5.1 — Organizer management & ticketing foundations

**Date:** 2026-10-09 (Africa/Lagos). **Status:** SOURCE IMPLEMENTED / OFFLINE TESTED, **NOT production or provider qualified**. **Base HEAD:** `7e7604106cefe979e4c04b8f8e0cd569acaeb073` on `phase3/low-friction-contact-20261009`. Use actual current Git HEAD on resume; historical pointers are not authoritative.

## Scope and direct source audit

The existing NestJS events API already implemented organizer creation, event drafts, ticket types, publishing, staff assignments, owner-scoped order reads, transaction-PIN-gated sandbox checkout, encrypted QR credentials and check-in. The ErhaPay-derived `apps/customer-ui/src/routes/dashboard/foundations/OrganizerOverview.tsx` was **read-only**, and `ConfirmEventsBooking.tsx` did **not** collect or transmit the transaction PIN required by the server. The original `apps/web` remains reference-only.

Implemented in this batch:

1. Preserve original ErhaPay FoundationPage / FoundationPanel / CustomButton and all 123 original visual assets. Add authenticated organizer profile creation, owner-scoped event listing, private draft creation and ticket-type configuration. Strict client parsing returns only safe organizer/event/ticket metadata, never settlement records or credentials. The backend derives ownerUserId from the authenticated session, never from caller-controlled request data.
2. Retain existing backend organizer/event/ticket contracts, monetary minor units and ticket-signing architecture; extend the client API allowlist solely for these existing endpoints. All mutations continue through stable session-bound CSRF.
3. Add an explicit 4-digit transaction PIN field and positive acknowledgement to the *existing* event confirmation screen. The PIN travels in the final authenticated API request, not persisted in `sessionStorage` or request idempotency hashes. Clear it after checkout submission and when starting a new attempt. The existing backend still enforces financial authorization, KYC/MFA/limits, quote total equality and sandbox restrictions independently.
4. Event publishing is **sandbox-only** and independently default-off: `EVENT_PUBLISH_SANDBOX_ENABLED=false` on API; `VITE_TWIPAY_EVENT_ORGANIZER_SANDBOX_ENABLED=false` on customer build. API **always rejects publishing in production** even if sandbox flag is set. Published events and legitimate historical records are not deleted by this change.
5. Serialize ticket-type creation and event publishing under an `events` row lock in a Prisma transaction, and recheck organizer ownership, status and the event lifecycle after acquiring the lock. This prevents ticket types being added based on stale pre-publication state. No changes to existing Prisma schema, migrations, ledger, provider adapters, ticket signature format, or refund/payout execution.
6. Retain default-off live event checkout (`EVENT_CHECKOUT_SANDBOX_ENABLED=false`) and ticket QR admission (`EVENT_TICKET_QR_SANDBOX_ENABLED=false`), as well as default-off financial providers. Ticket access is still guarded and encrypted by the existing API; this batch does **not** claim real-world check-in qualification.

## Scope boundary / not implemented

- No live organizer onboarding approval, organizer payouts, refund operations or staff scanner UI. No real customer wallet payments, external gateway payouts or QR admission.
- Not a complete event-platform release: account lifecycle/organizer KYC, live concurrency, provider settlement reconciliation, ticket scanning usability and browser visual parity remain Phase 5.2/Phase 6 work.
- The seller's stored ticket pricing and available capacity are authoritative *at the transaction check*, not evidence of any approved public listing or provider success. No guessed amounts, statuses or balances.

## Verification

- `node scripts/typescript-syntax-check.mjs`: PASS (480 TypeScript source files).
- `node scripts/repository-security-check.mjs`, `architecture-check.mjs`, `financial-invariant-check.mjs`, `services-events-invariant-check.mjs`, `product-operations-invariant-check.mjs`, `production-hardening-invariant-check.mjs`: PASS.
- `node scripts/design/erhapay-ui-inventory.mjs --check`: PASS; 123 original assets preserved (69 byte-identical, 54 normalized line endings, 0 materially changed), 66 routes.
- `node --experimental-strip-types --test docs/integration/test/*.test.mjs docs/migration/test/*.test.mjs docs/design/test/*.test.mjs docs/phase3/test/*.test.mjs docs/phase4/test/*.test.mjs docs/phase5/test/*.test.mjs docs/qualification/*.test.mjs scripts/test/*.test.mjs`: **386 passed, 0 failed**. Of these, 14 new focused Batch 5.1 tests exercise the actual organizer adapter and mocked backend service for owner binding, sandbox publication, row-lock ordering and PIN source contract. **Mocks are not real DB concurrency.** See `docs/phase5/evidence/batch-51-offline-regression-2026-10-09.txt`.
- `node scripts/qualification/phase1-3-preflight.mjs`: **5 PASS / 0 FAIL / 9 BLOCKED**: no Node 24, pnpm, frozen lockfile, Docker, PostgreSQL 18 or Redis 8. See evidence file. Browser E2E, real event issuance, signing-key rotation and provider scenarios are **not executed**.

## Next batch

**Phase 5.2 — secure ticket QR retrieval and check-in experience.** Reuse existing API QR credential/ownership contract and check-in service, keep `EVENT_TICKET_QR_SANDBOX_ENABLED` default-off, never cache bearer credentials, require organizer/staff authorization, test replay/concurrent scanning against PostgreSQL before release. Finish support, notification and admin functionality in later Phase 5 batches. Carry the blocked Node 24 / PostgreSQL / Redis / sandbox / Playwright gates into Phase 6; no production flags may be activated without evidence.
