# Initial managed-service profile

TwiPay business logic must not depend on these vendors. They are an initial low-operations deployment profile and may be replaced through standard PostgreSQL/Redis/email/error-monitoring boundaries.

## PostgreSQL / Neon

Use a PostgreSQL 18-compatible managed database with TLS, PITR/backup support, restricted network/credentials and separate staging/production databases. Before production promotion, execute the complete migration and concurrency suite against the exact target PostgreSQL major/version. Do not assume provider marketing compatibility is proof of the required database behavior.

## Redis / Upstash

Use a TLS Redis endpoint compatible with BullMQ requirements. API/worker secrets stay server-only. Qualify queue creation, retry/backoff, worker restart, recovery sweep and at-least-once idempotency against the exact service/plan before production.

## Resend

Use only server-side API credentials and a verified sender/domain. Provider delivery failures are notification failures, not financial rollback instructions. Keep retry/deduplication inside TwiPay notification orchestration.

## Sentry or approved equivalent

If Sentry is selected, keep the DSN/config server-side where appropriate, scrub headers/cookies/PII and verify that no BVN/NIN/account numbers/tokens/recovery codes/TOTP secrets are captured. Error-monitoring activation is an operational deployment step and must pass a staging redaction/fault test before production. TwiPay correctness must not depend on the monitoring vendor being available.

No account ID, zone ID, API token, DSN or credential belongs in this directory.
