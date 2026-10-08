# MFA incident runbook

## User lost authenticator

Use an unused recovery code through the normal challenge path. Support must never ask a user to send a TOTP secret or recovery code in chat/email. If no recovery code remains, follow an approved identity/account-recovery process; do not bypass MFA by editing `mfaSatisfiedAt` or deleting the credential.

## Suspected factor compromise

1. Revoke active sessions through the authorized operations path.
2. Preserve `security_events`, session and MFA history; they are append-only/auditable evidence.
3. After identity verification, disable the credential through an auditable workflow and require re-enrollment with a new secret.
4. Investigate failed-attempt/lock events, session rotation history, privileged actions and provider activity.

Never delete MFA rows or reset a used recovery code. Do not lower `MFA_STEP_UP_MAX_AGE_SECONDS`/attempt controls ad hoc to work around an incident.
