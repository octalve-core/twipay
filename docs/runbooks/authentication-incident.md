# Runbook — Authentication/Security Incident

1. Preserve evidence: request IDs, security events and affected session IDs. Do not copy raw tokens into tickets/chats.
2. Revoke affected sessions server-side; if scope is unclear, revoke all sessions for affected users.
3. Rotate the relevant secret only through the deployment secret store.
4. Confirm logs contain redacted credentials and no secret value.
5. Determine root cause and affected time window.
6. Add regression tests before redeployment.
7. Document significant incidents under `docs/incidents/` with secrets/PII removed.

## Task 3 session concurrency incident considerations

If a user reports unexpected MFA challenge rejection after successful factor entry, check redacted security events for a factor-consumed/session-rotation-failed sequence. The factor must not be reused. Require a fresh challenge on a newly authenticated session, or a secure recovery path. Investigate competing logout, disable, expiry and rotation operations using session IDs only (never raw tokens). Do not manually reset accepted TOTP steps or reactivate revoked sessions.

During a suspected stolen-session incident, revoke all affected sessions server-side and review the session-rotation audit chain. Verify the revocation against a live PostgreSQL-backed API, not merely a static code scanner. Confirm logout and new-session step-up from a fresh browser profile.
