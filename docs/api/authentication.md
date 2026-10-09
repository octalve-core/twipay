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
