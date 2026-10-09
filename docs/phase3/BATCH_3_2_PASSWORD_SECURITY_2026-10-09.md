# TwiPay Phase 3 / Batch 3.2 — Password and session security

**Date:** 2026-10-09. **Starting Git HEAD:** `79666af704e4c8a3a1a576f5e4049cf8bd3c7a4b`. **Status:** implemented in existing master, offline-tested; live runtime qualification deliberately deferred by the product owner. This is NOT a production-qualification report.

## Decisions and boundaries

- Preserve the original ErhaPay-derived `apps/customer-ui` design, layout, mobile behavior, temporary logo and asset inventory. The disabled reset screen is now integrated rather than redesigned. The former stubbed password-change API is replaced by a typed existing-API contract.
- No compulsory onboarding wizard, contact status bypass, localStorage credentials, new customer application, or financial functionality. The original ledger, holds, financial controls, Prisma migration history, service gates and admin authorization are untouched.
- Password recovery cannot grant a session or satisfy MFA. Successful password reset or authenticated password change revokes **every** active opaque session. User returns to login and completes the existing MFA and contact eligibility flow. A wrong current password does not invalidate a legitimate active session.

## API contracts (prefix `/v1/auth`)

| Endpoint | Body | Security and outcome |
|---|---|---|
| `POST /password/reset/request` | `{email}` | Public with strict browser Origin and IP rate limiting; generic `{ok:true}` even when account is unknown, unverified, disabled, cooling down or capped; queues email in existing encrypted outbox only for eligible verified account. No synchronous provider send or disclosure of existence. |
| `POST /password/reset/complete` | `{email, code, newPassword}` | Public with strict Origin and risk limit; exact eight-digit code, 10-minute TTL, HMAC/pepper digest, five failures, account/email binding, SQL user-row lock, single-use atomic consumption and password update. No session issued. |
| `POST /password/change` | `{currentPassword, newPassword}` | Authenticated, verified-contact, enabled-MFA-check and session-bound CSRF guarded; validates current password, enforces shared password length policy (12–128), disallows reuse and revokes all sessions. Clears caller cookies. |
| `GET /sessions` | none | Normal authenticated guard; owner-scoped currently active device metadata (without IP address). |
| `POST /sessions/revoke-others` | `{currentPassword}` | Authenticated + CSRF + password proof; revokes every other active session but retains current session. |

The password reset issuer is serialized by a database row lock, imposes 60 seconds between issues and five issued codes per rolling 24 hours, invalidates previous codes, and stores only a peppered HMAC digest, not the code. The outbox stores message body encrypted; security alerts are queued transactionally after successful password changes and resets. Credentials are hashed using the existing Argon2id hasher. Password-change and reset security events do not include codes/passwords. Browser responses use no-store API headers.

**Threat considerations:** Enumeration remains sensitive to observable database-vs-miss timing; public endpoints use a uniform response and avoid blocking on email provider I/O. The current per-IP Fastify limiter is per-process only; distributed ingress control and DB/worker contention tests are **required before launch**. Validation, lockout, raw HTTP session cookies/CSRF, database migration, actual email delivery and all real browser UX remain unverified until trusted Node24/PostgreSQL18/Redis8/sandbox execution.

## Migration and interface

- New additive migration: `packages/database/prisma/migrations/0007_password_recovery_and_sessions/migration.sql`; password reset table and attempt-count check, indexes and FK. No modifications to money tables.
- Original `VerifyEmailForm`, `CreateNewPasswordForm`, `ResetPassword`, `LogInForm`, `ChangePasswordForm`, `SecuritySettings` wired with typed endpoints. Reset success routes to **login** rather than the original historical success component that redirected to an authenticated dashboard.
- Customer password strength indicator is aligned to server minimum 12 characters. Existing ErhaPay colors/fonts/components retained. `apps/web` remains only an archival reference.

## Executed offline checks

- 255/255 Node isolated/source/transpiled-with-mocks tests PASS (includes 20 Batch 3.2-specific cases).
- TypeScript syntax parser PASS; repository security, architecture, financial, services/events, product operations and production-hardening scanners PASS.
- Visual source inventory PASS (329 customer source files; 123 original image assets, **0 material changes**). This does **not** establish real pixel/DOM parity.
- `git diff --check` PASS.

## Deferred mandatory runtime gates

- Node24/pnpm frozen dependency install, TypeScript semantic/typechecking and full builds; Prisma7 migration against disposable PostgreSQL18; Redis8 workers/concurrency; actual row-lock races across Prisma pools and replay tests; live HTTP CSRF/origin/security and UI/browser/E2E; Resend controlled-inbox delivery, retry, bounce and alert latency; distributed abuse controls.
- All Phase 3.1 runtime blockers remain **BLOCKED**, not passed. Avoid live feature activation. Resume qualification using the existing disposable `scripts/qualification/phase1-3-run-local.sh --phase3-1` runner after supplying the authentic lockfile and trusted infrastructure; expand for Batch 3.2 before release.

**Next development:** Phase 3.3 Google authorization-code OIDC with PKCE/state/nonce and protected account linking, then account security/MFA/KYC recovery and mandatory transaction PIN lifecycle. No historical Firebase popup/localStorage integration and no PIN substitution for MFA.
