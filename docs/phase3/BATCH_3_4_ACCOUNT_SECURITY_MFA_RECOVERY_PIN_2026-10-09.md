# TwiPay Phase 3 / Batch 3.4 — Account Security, MFA Recovery, Transaction PIN

**Date:** 2026-10-09 (Africa/Lagos). **Source baseline:** Git `9c6d196eb2f747217f568b1065c435065d03e876`, branch `phase3/low-friction-contact-20261009`. **Status:** code implementation and offline tests. **NOT** runtime qualification or live financial authorization.

## Approved product/security boundaries

- Preserve one original ErhaPay-derived `apps/customer-ui` and the Git-backed NestJS/Fastify monorepo. No new design system, compulsory post-signup wizard or frontend-trusted authorization.
- **Four-digit PIN lifecycle is implemented as credential management only.** Phase 4 must validate it server-side against actual financial intents, limits, KYC, MFA and wallet holds. Not a substitute for account password or MFA. Keep all unqualified financial features OFF.
- MFA already supports TOTP + hashed single-use backup/recovery codes. The signed-in customer can regenerate backup codes only with a valid current TOTP or recovery factor; sign-in challenge accepts either. These remain the supported **self-service MFA recovery** mechanisms. Email alone must never disable or reset active MFA. If both the device and recovery codes are lost, require a separately designed, supervised recovery policy; it is NOT implemented here.
- A Google-only customer may add a password only while holding a valid contact-verified authenticated session, with satisfied MFA if the account already has it, AND by consuming a fresh code delivered to their *existing verified email*. Existing passwords cannot be replaced by this route. No automatic email-matched OAuth linking.

## Additive database and credential protections

Migration: `packages/database/prisma/migrations/0009_account_security_transaction_pin/migration.sql` introduces transaction PIN credentials, purpose-specific email challenges for PIN reset and Google-only password setup, associated security events and checks/indexes. No changes to ledger, holds, services, financial tables or provider controls. Existing migration lineage is unchanged.

**PIN:** `POST /v1/auth/transaction-pin/set`, `/change`, `/reset/request`, `/reset/complete` and `GET /status` require a verified-contact authenticated session. Every POST has strict Origin, session-bound CSRF and MFA enforcement (if MFA active), plus a local risk rate bucket. PINs use a **distinct 32+ character server-only `TRANSACTION_PIN_PEPPER`**, user-and-domain HMAC, then Argon2id; never store plaintext or an unpeppered 4-digit PIN hash. Basic weak-PIN patterns are rejected. Setup requires account password proof; change requires password + current PIN, has five failures then 30-minute persistent lockout under per-user PostgreSQL row lock. Successful changes clear failure state and invalidate reset challenges. Every successful security modification is audited and queues an encrypted security notification without any PIN/password or reset code in audit metadata.

**Forgot PIN:** Customer proves account password, then receives an eight-digit challenge by email, 10-minute expiry, five guesses, 60-second issue cooldown and five issues per rolling day. The HMAC challenge binds `userId`, **sessionId**, verified email and purpose. Confirmation requires password again, the same session and correct unused OTP under account-level DB lock; previous sessions are revoked, security notification queued, and any lockout clears only on successful reset. Notification provider success is never invented. No reset may sign a customer in or authorize a transaction.

**Google-only password:** Endpoints `GET /v1/auth/password/enrollment/status`, `POST /request`, `POST /complete` use identical session CSRF/contact/MFA guard, purpose-bound email code, cooldown and failed-guess controls. Transaction under user row lock checks ACTIVE, verified email, Google identity and no existing password. A successful code creates the password with the existing password policy and Argon2id hasher; it consumes challenges, revokes **all sessions**, records a security event and queues an encrypted security alert. Customer signs in again to continue with MFA/PIN management.

**Configuration:** Set `TRANSACTION_PIN_PEPPER` to a non-reused secret of at least 32 characters through the server secret manager. It is optional at server startup to preserve backwards compatibility while PIN setup remains unqualified; PIN cryptographic operations **fail closed** if missing. This must be present and retained before migrating any live PIN credentials. It must not be changed or lost without an approved PIN recovery/rotation process.

## Original ErhaPay interface changes

- Reuse the original security settings panel, MFA form, PIN modal, typography, spacing, buttons and mobile dialog. PIN set/change now talk to the secured endpoints and request password step-up; a separate in-modal forgot-PIN code flow handles reset. The status on `/auth/me` and dashboard reflects the **actual** database PIN credential, not fake `pinActivatedAt` state.
- Google-only signed-in users see verified-email password setup, not inaccessible password-based PIN/MFA controls. Password success revokes sessions and returns to login.
- The historical `/auth/set-pin` onboarding route is retired to a guarded redirect into dashboard security; no more `skip` button or auto-success.
- Original MFA recovery-code entry and re-generation logic are preserved. Added customer guidance that email cannot defeat MFA.
- 123 original ErhaPay visual assets are intact (69 byte-exact, 54 SVG line-ending normalization; zero material changes). Real screenshot/DOM parity is NOT verified.

## Test evidence and required release work

- The Batch 3.4 service suite runs transpiled actual service code with isolated in-memory Prisma/notification/Argon2 seams, **not** real Argon2 cost, PostgreSQL transactions, provider delivery or a live browser. It covers credential setup/duplicate rejection, wrong password/current PIN, five failures/lockout, password+OTP reset, wrong session, expired/reused/exhausted codes, concurrent requests and consumption, Google-only credential setup/expiry/replay, and request guard/client/migration contracts.
- Full offline isolated regression, syntax scanner, security/architecture/financial/service/operations invariants, ErhaPay source design inventory: captured in Git checkpoint evidence and continuation.
- **Deferred, not waived:** Node24/pnpm lock/frozen install and builds/semantic typechecks; Prisma7 migration on disposable PostgreSQL18 and concurrent row locking across pools; Redis8/worker integration; real Fastify cookies/CSRF/Origin/MFA; Resend inbox delivery; browser UI/E2E and accessibility; distributed rate limiting; Google provider qualification; dynamic scanner/security reviews.
- **Phase 4 mandatory before financial enablement:** verify PIN in the API for *each covered intent* before wallet holds, with independent KYC/contact/MFA, limits, ownership, balances, idempotency, ledger invariants, fraud and provider guards; no frontend-only PIN checks. Do not expose a standalone client-supplied `verifiedPin` boolean.

**Risk disclosure:** Browser and live Postgres tests cannot be run in the current Node22/no-pnpm/no-PostgreSQL/Redis runner. Do not claim the new migration or authentication flows work in production based on isolated tests.
