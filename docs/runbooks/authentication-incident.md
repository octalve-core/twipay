# Runbook — Authentication/Security Incident

1. Preserve evidence: request IDs, security events and affected session IDs. Do not copy raw tokens into tickets/chats.
2. Revoke affected sessions server-side; if scope is unclear, revoke all sessions for affected users.
3. Rotate the relevant secret only through the deployment secret store.
4. Confirm logs contain redacted credentials and no secret value.
5. Determine root cause and affected time window.
6. Add regression tests before redeployment.
7. Document significant incidents under `docs/incidents/` with secrets/PII removed.
