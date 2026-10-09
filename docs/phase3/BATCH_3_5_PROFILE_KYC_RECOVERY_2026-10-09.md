# TwiPay Phase 3 / Batch 3.5 — Profile, KYC Continuity and Account Completion

**Implementation date:** 2026-10-09 (Africa/Lagos). **Baseline:** `5f615b19fce98133262a34956d278dbb7cd705b8`, branch `phase3/low-friction-contact-20261009`. **Release status:** source-implemented and offline-tested; Node 24, database, provider and browser qualification *deferred, not waived*.

## Accepted direction and preserved invariants

- This work modifies the **existing** Git-backed master. The ErhaPay React/Vite customer dashboard is still authoritative; `apps/web` remains a reference only. Original 123 visual assets and typography preserved. The old authentication-side mockup is still not the actual dashboard.
- Signup remains first name, last name, email, password. Email verification must succeed before unrestricted dashboard entry; no compulsory KYC/PIN setup wizard. Google OIDC/MFA and transaction PIN Phase 3 source work preserved.
- All money-moving, virtual-account, ticket-checkout and unqualified provider features **remain disabled**. This batch makes no changes to financial eligibility, provider activation, ledger, transfer limits, wallet holds, event purchases, banking, or user authorization decisions. Phase 4 must perform real server-side PIN/KYC/MFA/contact validation per covered financial intent before holds.

## Implemented contracts

### Profile and customer screen

- Additive Prisma 7 migration `0010_profile_and_kyc_continuity` adds optional `users.countryCode CHAR(2)` and `users.stateRegion VARCHAR(100)`. These are **self-reported profile details, not verified residential location or KYC evidence**. No migration or change to phone/email verification, identity facts or financial tables.
- `PATCH /v1/auth/me` (already guarded by authenticated session, verified contact, active MFA where configured, CSRF, Origin and Zod strict input) now supports nullable countryCode and stateRegion alongside existing names; two uppercase letters and 1–100 trimmed characters, respectively. Read via existing `GET /v1/auth/me`, including nulls. No bulk-field update, mutable email, DOB, avatar-upload, username invention or unverified phone change.
- Reuses original ErhaPay Account Settings fields: names and optional location; verified email remains read-only, location is explicitly non-KYC; UI refreshes `/auth/me` after save. Removed the fabricated username display from the customer mapping, and the dashboard greeting now uses the actual first name.
- Removed the original nonfunctional 'Delete account' confirmation that misleadingly claimed immediate irreversible deletion; kept its row styling but no destructive action. Proper account closure needs pending-wallet/ledger, refunds/disputes, AML/records retention, maker-checker and session-revocation policy before a server endpoint is offered.

### KYC recovery / continuation

- The existing `GET /v1/kyc/verifications` reads **only the authenticated owner's** history. It now returns safe, minimized `verificationMethods`, `otpRequested` and `expiresAt`/status alongside already exposed type/last-four metadata, without identifier ciphertext, fingerprints, provider response payload or OTPs.
- For newly initiated `AWAITING_CONSENT` checks, the service stores only sanitized unique plain-text method labels returned by the provider (maximum ten). The UI can reopen the recorded method choice from history without retransmitting or caching raw BVN/NIN or code in localStorage. Pending checks can reopen OTP only when the server previously recorded an OTP-request flow.
- The API rejects a continuation belonging to another customer, an expired or terminal check, a method not in the recorded provider options, or unsolicited OTP without a prior persisted request. A stale consent record is not reused as an active verification. Provider processing remains `PENDING`/unknown rather than fabricated `VERIFIED`.
- All existing idempotency scopes, default-off provider configuration, paid verification quotas, request schema and risk gates retained. A transient provider failure is **not interpreted as success** and does not trigger a blind charge retry. Older verification records without stored methods do not falsely show a recovery path; they require supported re-initiation or operator/provider reconciliation.
- The dashboard's BVN-based identity status reminder no longer calls expired consent a resumable in-progress status. Successful KYC confirmation refreshes the authenticated status, but **does not** imply KYC tier or release of financial restrictions. KYC provider callbacks/requery, advanced document remediation, capture/upload, distributed per-verification locking, and provider-specific eligibility remain separate planned work.

## Test evidence and limitations

- `node --experimental-strip-types --test docs/phase3/test/batch-35-profile-kyc.test.mjs`: **8/8 pass**. Exercises actual transpiled KycService/AuthService with mocked Prisma/provider seams: owner-only history and continuation, expiry, unadvertised methods, unsolicited OTP, safe history projections, method request/resume, partial profile updates, additive schema/API guard contract.
- Offline combined regression command (see evidence file): **296 passed, 0 failed**. TypeScript syntax, repository security, architecture, financial/services/events/product/operations/production-hardening scanners and original ErhaPay asset inventory also PASS. Test counts are source/mocked only; no production readiness is asserted.
- **Pending release tests:** authentic pnpm frozen installation and Node 24 build/typecheck, Prisma 7 migration against disposable PostgreSQL 18, concurrent idempotency/provider calls across connections, Redis 8 workers, real NestJS/Fastify cookies/CSRF/MFA/ownership, Mono identity provider sandbox (including method semantics and charged attempts), live Google/Resend, and original ErhaPay full-browser visual/E2E/accessibility comparison. None passed in this runner.

## Explicitly deferred account-product capabilities

Username, government-document upload, portrait/media hosting, verified phone number/change, changing verified email, user-controlled bank beneficiary CRUD, automatic KYC rejection appeals and self-service closure require separate policy/contract/migrations/provider qualification; they were **not** presented as functional. An unverified profile location may not satisfy KYC or be relied on for account eligibility.

**Next after this checkpoint:** Phase 3 acceptance review and then Phase 4 financial intents with independent PIN/MFA/KYC/risk/ledger enforcement; maintain default-off provider switches and do not activate without runtime qualification.
