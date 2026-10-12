# Authentication API

Base prefix: `/v1/auth`.

- `POST /register` — creates first-party account and opaque browser session.
- `POST /login` — validates password and creates a new session.
- `POST /logout` — revokes current session; requires CSRF protection.
- `GET /me` — resolves current session.
- `GET /csrf` — returns the stable current-session CSRF token for in-memory use after a page reload.

Browser requests use `credentials: include`. No bearer token is returned for browser persistence. Unsafe authenticated requests send the readable CSRF cookie value in `X-CSRF-Token`; the real session cookie remains HttpOnly.

## Phase 3.1 — verified-contact registration (source implemented; runtime qualification pending)

- `POST /auth/register` accepts first name (`givenName`), last name (`familyName`), email and password; creates an ACTIVE account, restricted opaque session, one-time hashed email challenge and encrypted email notification atomically. Response `verificationDelivery` is `DELIVERED`, `ACCEPTED` or `PENDING`, **not** an assertion that the message reached the inbox.
- `GET /auth/me` returns `user.emailVerifiedAt`, `user.phoneVerifiedAt`, `user.contactVerified`, `user.identityVerificationStatus` (BVN-backed prerequisite summary, not payment approval) and `user.transactionPinStatus='NOT_AVAILABLE'` (credential management not implemented yet). It also returns existing role/permission/MFA status.
- `POST /auth/contact/email/resend` is authenticated, session-CSRF-protected, throttled and returns `{deliveryStatus}`.
- `POST /auth/contact/email/confirm` accepts `{code: string}` (exactly six digits); on success consumes the code and rotates the session, returning `{verified:true, csrfToken}`. The existing MFA assurance is reset and independently enforced. Invalid, stale or reused codes never verify an account.
- Account access requires `contactVerified` on any `SessionAuthGuard` route by default. Only the confirm/resend and MFA status/challenge routes are annotated to permit restricted sessions. Sessions with an enabled MFA credential also require completed, recent MFA for ordinary authenticated APIs; the exemption routes remain independently session- and CSRF-protected. Backend financial operations are additionally controlled by their existing independent default-off flags and requirements; contact verification alone does not authorize a payment.

Email resend: 60-second minimum between challenges, ten issues per rolling day, five guesses per code, ten-minute code validity. A running database, delivery provider and distributed rate limiter are required to qualify these security claims, not just source tests. Phone verification is **not** available yet. Password recovery, Google OIDC and transaction PIN management remain Phase 3 follow-on work.

## Phase 3.2 — password recovery/change and device sessions (source implemented; runtime qualification deferred)

- `POST /auth/password/reset/request` accepts `{email}` and always answers `{ok:true}` for validly shaped email input. No login cookie or CSRF is required, but a trusted browser Origin and IP rate limiting **are** required. Eligible active, email-verified accounts receive an eight-digit, ten-minute reset code via the existing encrypted notification outbox. Request issuance is row-serialized with a one-minute cooldown and at most five issues per rolling 24 hours; backend does not return the code or wait for provider delivery.
- `POST /auth/password/reset/complete` accepts `{email, code, newPassword}` and consumes an eligible code once. At most five incorrect attempts are permitted. The existing Argon2id password credential is updated under SQL row lock; every old session is revoked; an email security alert is queued. No session is minted and MFA is never waived.
- `POST /auth/password/change` accepts `{currentPassword, newPassword}` under `SessionAuthGuard` and session CSRF. The current password and backend password policy are checked; successful change revokes all sessions, clears cookies, enqueues an alert and requires a fresh login. Invalid current credentials return 403 without erasing valid client auth state.
- `GET /auth/sessions` lists only the requesting customer's active session metadata and indicates the current device. `POST /auth/sessions/revoke-others` requires current password, authenticated session and CSRF to revoke other sessions while preserving the caller.
- Password credentials are 12–128 characters by the shared backend policy. Password reset codes are one-way HMAC digests, email-bound, short-lived, failed-attempt-limited and single-use; no password, code, token or raw IP is exposed in security events. Per-IP rate limiting is in-memory and is **not** distributed brute-force protection.

All descriptions above are implementation contracts subject to pending Node24/full build, PostgreSQL 18/Redis 8, live HTTP/browser, race-condition and actual Resend sandbox-delivery verification. No production readiness is asserted.
