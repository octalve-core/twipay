# Security attack regression matrix

Batch 5 security qualification combines repository/static invariants, database constraints, dependency-backed unit/integration tests, real-browser E2E, supply-chain scanning and staging DAST. A source-level check is not a substitute for a runtime attack test where runtime proof is required.

| Attack / misuse | Required evidence |
|---|---|
| authentication bypass | unauthenticated protected API/browser paths reject access |
| BOLA / IDOR | a second customer cannot access first-customer wallets, transactions, organizer/event resources or tickets by guessed IDs |
| horizontal/vertical escalation | role/ownership and permission tests reject cross-user and unauthorized staff actions |
| admin bypass | customer session cannot use admin financial/operations endpoints |
| maker approving own action | application + PostgreSQL invariant reject same-actor maker/checker |
| stale MFA | high-risk operation rejects assurance older than `MFA_STEP_UP_MAX_AGE_SECONDS` |
| TOTP replay | already accepted timestep is rejected in service and DB monotonic guard |
| recovery replay | consumed recovery code is rejected; DB prevents `usedAt` reset/delete |
| session fixation / stolen pre-MFA session | successful step-up rotates opaque token+CSRF; old token is revoked and cannot inherit assurance |
| idle / absolute expiry | resolver marks session expired with explicit reason and rejects reuse; rotation cannot extend absolute lifetime |
| revoked session reuse | revoked token is rejected |
| CSRF | unsafe authenticated request without valid CSRF token is rejected |
| malicious Origin / CORS | untrusted exact origin rejected; no authenticated wildcard CORS |
| XSS / CSP | web/admin emit nonce CSP with `strict-dynamic`, no wildcard/unsafe-inline script policy; staging browser/DAST validation |
| injection / mass assignment | strict request schemas + database/query tests reject unexpected fields/injection payloads |
| open redirect | auth/OIDC redirect targets are fixed/allow-listed, never arbitrary request URLs |
| sensitive URL values | repository/browser tests confirm secrets, OTPs, BVN/NIN and provider credentials are not query/path material |
| frontend secret leakage | production bundles/environment expose only explicitly public non-secret values |
| PII/log leakage | structured-log redaction + runtime fault tests inspect logs for forbidden values |
| rate-limit bypass | per-risk endpoint tests prove repeated attempts receive limits at app/edge layer |
| webhook forgery/replay | signature/replay/dedup tests reject forged/duplicate events |
| duplicate money movement | DB/idempotency/concurrency/provider callback tests prove at-most-once logical financial effect |

The release matrix must distinguish what actually ran locally/CI/staging from what is merely authored. Browser E2E, real PostgreSQL/Redis, DAST and provider sandbox rows remain `BLOCKED` until executed in the qualified environment.
