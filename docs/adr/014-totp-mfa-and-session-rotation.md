# ADR 014 — TOTP MFA, recovery credentials and session rotation

**Status:** Accepted for Batch 5

TwiPay uses standards-compatible TOTP as the V1 second factor. The TOTP secret is encrypted at rest, recovery codes are returned only at creation/replacement and persisted only as keyed HMAC digests, and accepted TOTP timesteps advance monotonically. Failed attempts are bounded/locked. MFA disable is an auditable state transition; credentials are not deleted.

Successful enrollment/challenge/recovery transitions rotate the opaque browser session. The old session is revoked and the replacement retains the original absolute expiry, preventing both stolen pre-MFA sessions from inheriting assurance and repeated step-up from extending login lifetime. `mfaSatisfiedAt` is immutable on an existing session and is set only on a replacement session.

Passkeys/WebAuthn are deliberately not claimed in V1. They can be added later as a stronger factor without replacing the opaque server-session model.

## Task 3 clarification — concurrent transitions

Session rotation uses an ACTIVE-row compare-and-update before replacement creation in one transaction, so only one successful replacement may be created from an old session. Idle touches and CSRF refreshes use conditional ACTIVE/nonexpired writes, denying requests if revocation wins the write race. These behaviors require PostgreSQL concurrency qualification. The factor-consumption/rotation separation remains deliberate pending a transaction design review; never roll back a consumed factor independently of its replay guard. Authorization already granted to an in-flight request is not a proof of real-time cancellation after concurrent revocation; high-risk mutations require independent transactional authorization review.
