# Batch 01 — Foundation & Identity

**Status:** Implemented in source; dependency-backed build verification pending registry/network availability in the execution environment.

## Objectives
Create the TwiPay monorepo and security/identity foundation without carrying forward legacy backend coupling.

## Implemented
- Monorepo layout for web/admin/API/worker/shared packages.
- Next.js customer/admin application foundations and minimal TwiPay visual system.
- NestJS/Fastify API bootstrap, secure headers, exact CORS, OpenAPI bootstrap.
- PostgreSQL/Prisma identity schema: users, password credentials, OAuth identities, sessions, security events, roles and permissions.
- Opaque session design with hashed tokens, separate CSRF token hashes and revocation.
- Argon2id password hashing service.
- Google OIDC boundary and PKCE/state design documentation; live flow intentionally waits for deployment credentials + integration test.
- Worker foundation.
- Provider adapter directory boundaries.
- Local Docker Postgres/Redis.
- Secret/environment contract and repository security scanning scripts.
- CI definition and documentation/ADR framework.

## Security decisions
- No JWT/localStorage browser session.
- No actual secrets in source.
- No provider SDK calls from domain modules.
- Production session cookie uses `__Host-` prefix, HttpOnly, Secure and SameSite=Strict.
- Server stores only a one-way hash of session/CSRF values.
- Browser origins are explicit; wildcards are prohibited.

## Verification performed in this environment
See `BATCH_01_VERIFICATION.md` at repository root for commands and exact pass/block status.

## Known intentional deferrals
- Ledger/wallet/payment provider integrations are Batch 2.
- Interactive Google callback is activated only after Google credentials exist and can be integration-tested.
- Full CSP nonce strategy is finalized with migrated UI dependencies before public release.
- Rate limiting/fraud rules get endpoint-specific policies before production exposure.

## Next batch
Batch 2: double-entry ledger, wallet, idempotency, transaction state machines, Paystack/Monnify adapters, funding/virtual accounts/transfers, KYC adapter/Mono and reconciliation foundation.
