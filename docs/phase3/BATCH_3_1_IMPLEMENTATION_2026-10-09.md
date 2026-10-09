# TwiPay Phase 3 — Batch 3.1: Verified contact and low-friction onboarding

**Date:** 2026-10-09 | **Authority:** `TWIPAY_NEXT_CHAT_AUTHORITATIVE_HANDOFF_2026-10-09.md` | **Source master:** `e15b9e328c77b3b6836f260222cfaa3a9635addd` before Batch 3.1.

## Intent and retained constraints

This is an additive change to the existing Git-backed TwiPay master. Preserve `apps/customer-ui` (original ErhaPay component library and logo), `apps/api`, `apps/worker`, `apps/admin` and the non-authoritative `apps/web` reference. Maintain existing security, financial flags and ledger/migrations. Neither KYC nor PIN nor wallet funding is required merely to create an account. No financial feature is enabled.

## Backend contract

1. `POST /v1/auth/register`: four required fields (first name, last name, email, password); creates ACTIVE account (existing login lifecycle), a restricted opaque session, a hashed one-time email code and a notification queued in the existing encrypted outbox in a single transaction. Dispatch is best effort, never treated as proven delivery. Existing login accepts an unverified account **only into a restricted session**.
2. `GET /v1/auth/me`: authenticates current opaque session; returns authoritative email/phone contact timestamps, `contactVerified`, BVN-backed identity progress and `transactionPinStatus='NOT_AVAILABLE'`. Verified contact = email timestamp OR (stored E.164 number AND matching phone-verification timestamp); neither raw frontend storage nor mere phone claim is trusted.
3. `POST /v1/auth/contact/email/resend`: session+CSRF required, 60s cooldown, max 10 challenges/rolling 24h, row-serialized across replicas, invalidates earlier challenges. Returns only dispatch status.
4. `POST /v1/auth/contact/email/confirm` with six-digit code: session+CSRF required; row-serialized, HMAC digest verified in constant time, binds current user and current email, TTL 10min, max five guesses, single-use; successful consumption sets verified-contact timestamp, audits security event and rotates the opaque session with MFA assurance reset. Failed guesses commit their count before returning an error.
5. `SessionAuthGuard`: unverified sessions are denied ordinary authenticated APIs by default; accounts with enabled MFA additionally need a recent MFA-backed session before those APIs. Only explicit verification recovery actions and MFA challenge/status carry the restricted-access annotation. Existing request security, permission checks, ownership, and financial transaction gates remain independently enforced.
6. Outbox: uses existing `NotificationService` and `ResendAdapter`; no plaintext verification secret in browser response or audit event. Outbox stores the message encrypted, and provider acceptance is not inbox delivery. No SMS sending until phone enrollment is securely implemented.

## Customer experience

- Preserve original ErhaPay desktop/sidebar/mobile/dashboard/auth components and assets, no replacement design system.
- Signup routes to `/auth/verify-email`, never direct dashboard. If MFA is enabled on a returning session, the MFA challenge takes precedence. Restoration from `/auth/me` handles interrupted signup and login. Both the React route guard and API enforce the contact boundary.
- The email screen uses original OTP controls with warm copy and resend button. An email already verified redirects to dashboard. The UI does not expose backend/security terminology.
- Dashboard reminders come from `/auth/me`: BVN-backed identity status and PIN credential availability. PIN setup is explicitly described as under preparation until server credential lifecycle exists. A verified NIN alone does not certify the BVN-backed funding prerequisite; this is **not** a grant of financial eligibility.

## Security and engineering notes

- Email change must later reset `emailVerifiedAt` and invalidate challenges atomically, subject to reauthentication. Do not add an insecure edit shortcut.
- Local per-IP risk limit is defense in depth, **not** a substitute for distributed abuse controls. Database user-row locks ensure code-resend/verification atomicity but require real PostgreSQL contention validation.
- If a delivery provider is unavailable, the account stays restricted; the queued code cannot be authenticated without actual access to the mailbox. Dispatch status and retry handling must be qualified with provider sandbox evidence.
- Phase 3 next: password reset/change, properly linked Google OIDC code+PKCE, MFA expansion, KYC recovery, transaction PIN setup/change/reset. Phase 4: validate PIN, KYC tier and MFA **before actual financial intents and wallet holds**. These are **not implemented by Batch 3.1**. Ticketing/financial activation and live provider qualifications remain blocked.

See `docs/ADR-0020-VERIFIED-CONTACT-ACCESS.md`, `docs/api/authentication.md`, `docs/phase3/BATCH_3_1_VERIFICATION_2026-10-09.md` and the test sources.
