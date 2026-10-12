# TwiPay: owner identity bootstrap (restricted operations runbook)

There is no `SUPER_ADMIN` signup, default password or automatic owner user in the code or migrations. Never expose a public or authenticated HTTP endpoint that grants `SUPER_ADMIN`. A privileged account must first be an ordinary active, email-verified account with a correctly enrolled MFA credential.

## Out-of-band controlled procedure (no SQL script automatically executed)

1. On an isolated, qualified environment, two independently authorized security/operations custodians review a written request for each intended owner account and verify its legal operational basis. Record the change ticket, identities, purpose and approved environment **outside** the application.
2. Require unique individual accounts, verified contact, strong authentication with active authenticator MFA and a non-shared credential. No shared owner login, temporary universal passwords or bypass tokens.
3. Review the exact `users.id` UUID, `users.status='ACTIVE'`, non-null `emailVerifiedAt` and existence of an active `mfa_credentials` row. Cross-check the approved identities out-of-band. Do not copy private verification data into logs.
4. In a separately supervised, short-lived DBA maintenance session, verify `roles.code='SUPER_ADMIN'` exists. Explicitly grant that role **only to the individually approved UUIDs**, in a reviewed transaction, logging actor, case reference, timestamps and before/after grants in the independent security change system. No application API or automatic migration grants an owner.
5. Provision at least **two** independently controlled owner identities before using staff maker/checker approvals. One person must not possess both reviewer accounts. Verify step-up MFA, restricted API responses and audit retention.
6. Remove temporary elevated database access, rotate any exposed credentials, validate session expiry and inspect the exact grants. Test against a disposable database and qualified Node 24 deployment before executing in production.
7. To recover from lost owner access or a compromised owner, stop privileged modifications and follow formal incident response and DBA-supervised removal, not a browser self-service role change. Audit and review restoration separately.

## Release restrictions

`OWNER_GOVERNANCE_SANDBOX_ENABLED` is false by default, and production changes are hard-blocked regardless of its value. There is no unrestricted owner enable switch. Financial approvals still require distinct maker/checker duties and independent runtime/provider qualification.

This runbook intentionally does not distribute a ready-to-run SQL privilege-escalation script, create owner users, or weaken financial/reconciliation invariants.
