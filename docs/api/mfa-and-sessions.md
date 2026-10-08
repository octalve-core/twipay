# MFA and session security API

Browser authentication remains an opaque server-side session. JavaScript never receives a long-lived session token; the cookie is HttpOnly and state-changing browser requests additionally require exact Origin plus CSRF.

## Session lifetime

`SESSION_ABSOLUTE_TTL_SECONDS` is the hard lifetime. `SESSION_IDLE_TTL_SECONDS` is enforced when a session is resolved from `lastSeenAt`; an idle session is transitioned to `EXPIRED` with `IDLE_TTL_EXPIRED`. `SESSION_TOUCH_INTERVAL_SECONDS` bounds write frequency while preserving idle tracking. Session rotation retains the original absolute expiry.

## MFA endpoints

All endpoints below are under `/v1` and authenticated:

- `GET /auth/mfa/status`
- `POST /auth/mfa/enroll` — password re-authentication starts a short-lived enrollment and returns an `otpauth://` URI plus manual secret.
- `POST /auth/mfa/enroll/confirm` — accepts a fresh TOTP, enables the credential, returns one-time recovery codes and rotates the session with MFA assurance.
- `POST /auth/mfa/challenge` — TOTP or unused recovery code; rotates the session on success.
- `POST /auth/mfa/recovery-codes/regenerate` — factor verification consumes/replaces all remaining recovery codes and rotates the session.
- `POST /auth/mfa/disable` — factor verification, auditable credential disable, remaining recovery-code consumption, current-session rotation without assurance and revocation of other active sessions.

TOTP verification accepts only the configured bounded clock window and rejects any timestep at or below the last accepted timestep. Recovery codes are one-time. High-risk operations use the recent assurance window `MFA_STEP_UP_MAX_AGE_SECONDS`.

## Task 3 session concurrency hardening (pending runtime qualification)

A session rotation conditionally revokes the old ACTIVE row inside the same database transaction that creates the replacement and its audit event. If a concurrent logout, expiry, or rotation already claimed the row, no replacement is minted. The new session retains the original absolute expiration and receives a fresh CSRF hash. Re-authentication of an inactive user is not permitted during rotation.

A periodic last-seen touch and CSRF renewal also require an unexpired, non-idle, ACTIVE session in the database at mutation time. If the conditional write loses a race with revocation, reject the request rather than claiming it was refreshed. Cookies are HttpOnly for the opaque session; the non-HttpOnly CSRF cookie carries only the CSRF value.

These conditions are implemented in source and covered by test *definitions*, but atomicity, lock behavior, and concurrent-session race outcomes MUST be verified on PostgreSQL 18 with a genuinely installed dependency graph before production qualification. MFA factor use and session rotation still span separate transactions: factor consumption can succeed even when rotation subsequently fails. Never restore a used factor or bypass replay protection to mask that failure.

The active-session read used by authorization may still race with a concurrent revoke after the guard has authorized the request. Financial mutations must enforce their own authorization and transaction boundaries; this is not proof of an instantaneous global revocation barrier. Task 4 must audit sensitive operations individually.
