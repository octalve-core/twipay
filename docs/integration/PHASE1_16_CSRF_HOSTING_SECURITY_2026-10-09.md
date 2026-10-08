# TwiPay Phase 1.6 — Session CSRF and Customer Hosting Boundary

Date: 2026-10-09. Branch: `integration/phase1-developer-runtime-20261008`.

## Scope and change control

Continues the same Phase 1 master after commit `311f118d32f14b2c3faebfa83ac6242db14e6235`. Source-level security remediation only. No feature flags were enabled; no money movement or provider calls occurred. Original ErhaPay React routes, layouts, and image assets were not changed. Google OIDC and mandatory transaction PIN remain unimplemented Phase 3/4 requirements.

## The reproduced source issue

Before this checkpoint each request to `GET /v1/auth/csrf` generated a different random CSRF token and overwrote the one hash in the session row. Two forms sending concurrent authenticated mutations could have their tokens invalidated by each other's GETs. This was independently visible in `SessionService.rotateCsrf` and the Axios request interceptor. This was a source-confirmed race, not an observed successful attack.

## Resolution

- A token is deterministically derived using HMAC-SHA-256 with domain separation from the opaque per-session token and server-held `SESSION_HASH_PEPPER`. It is never logged or persisted in plaintext. Token changes with login/session rotation and revocation.
- The initial persisted `csrfTokenHash` of newly created/replacement sessions matches that derived token. Repeated `GET /v1/auth/csrf` does **not** mutate the hash.
- Pre-upgrade active sessions with random token hashes are migrated once using `updateMany` compare-and-set, conditional on still being active, unexpired and not idle. Concurrent migration reads derive the same value. Losing writers re-read and require the expected hash and active session. No destructive DB migration needed.
- Request mutation guard still enforces exact allowed `Origin`, API-host cookie/header equality and a server-side HMAC hash check tied to the active authenticated session. Cookies remain host-only `SameSite=Strict`, and session IDs are not exposed to the customer app.
- During first access after deployment, an in-flight old-session request might fail with `CSRF_INVALID` if another request migrates that legacy hash. This is a safe failure; the next request fetches the stable token. Real concurrent legacy-session integration testing is still **required**.

## Customer hosting source contract

`apps/customer-ui/vercel.json` now rewrites SPA deep links to `/index.html` and sends baseline defensive headers. Do not introduce a CSP or cache behavior without a verified production build/browser test. API replies already set `Cache-Control: no-store`. The SPA/static-asset behavior, security headers, and caching still require a deployed staging smoke test.

`node scripts/qualification/check-customer-hosting.mjs` is a **no-network, no-deployment** host-policy validator. It requires the explicitly approved organization-controlled site host and three distinct HTTPS origins within that site: the actual Vite customer app, the admin app and the public API. This matches current host-only API session cookies and `SameSite=Strict`. For example, `app.company.example`, `admin.company.example`, and `api.company.example` can work with an approved `company.example`. A customer frontend on `*.vercel.app` with an API on a separate organizational site **cannot** be qualified with the current cookie model. Do not relax cookie attributes to make such a deployment appear to work.

The gate fails if any Vite financial flag is true/missing, if `VITE_` keys suggest embedded secrets, if the SPA rewrite is absent, or if baseline response headers are missing. Add approved environment-specific GitHub Actions **environment variables**, not credentials, then run `Customer hosting security gate` on the approved `staging` or `production` environment. It checks configuration only; no live DNS, TLS, DAST, or cookie flow is tested.

Required environment variables (no values assumed):
- `TWIPAY_APPROVED_SITE_HOST`: approved parent domain under organizational control
- `APP_URL`: deployed Vite customer HTTPS origin
- `ADMIN_URL`: separate admin HTTPS origin
- `VITE_TWIPAY_API_URL`: public API HTTPS origin, used by Vite at build time
- `VITE_TWIPAY_FUNDING_SANDBOX_ENABLED=false`, `VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED=false`, `VITE_TWIPAY_VIRTUAL_ACCOUNT_SANDBOX_ENABLED=false`, `VITE_TWIPAY_BILLS_SANDBOX_ENABLED=false`, `VITE_TWIPAY_EVENT_CHECKOUT_SANDBOX_ENABLED=false`

The corresponding API runtime must have matching `APP_URL` and `ADMIN_URL` exact origins. Provider/private environment variables must remain on the API/worker only. Because Vite bakes `VITE_` values into the client build, changing the endpoint or flags requires a new deployment.

### Live staging tests still mandatory

1. Reproducible Node 24.21.0/pnpm 12.9.1 frozen full lockfile install, Prisma generation, PostgreSQL 18 migrations, Redis 8 worker recovery, and all builds; these have NOT run here.
2. Two parallel authenticated mutations from one browser session, including legacy-session migration and concurrent logout/revocation; assert cookie/header/server state correctness in real PostgreSQL.
3. Test register/login/logout/MFA session rotation, idle timeout, CSRF mismatches, unapproved Origin/OPTIONS CORS, cross-origin Cookie/SameSite with actual deployed HTTPS origins.
4. Direct SPA deep-link refresh, hashed CSS/JS/media delivery, security headers/CSP compatibility, page cache restrictions, browser visual baseline and eight viewports.
5. Finance roles, admin RBAC, provider sandbox transactions and ledger/reconciliation behavior separately; all financial/ticket operations remain default off.
6. Review genuine developer execution reports once supplied; none accompanies this checkpoint. No production deployment or provider transaction was performed.

## Executed locally

- `node --experimental-strip-types --test docs/integration/test/phase1-csrf-hosting.test.mjs` — passes 11 isolated source/policy tests.
- `node --experimental-strip-types --test docs/migration/test/*.test.mjs docs/qualification/batch-f-ticket-security.test.mjs` — existing suite 104/104 PASS.
- `node --experimental-strip-types --test docs/integration/test/*.test.mjs scripts/test/stack-readiness.test.mjs` — 43/43 PASS.
- TypeScript **syntax**, repository security, architecture, ledger invariants, services/events, operations, hardening and Git history secret scan — PASS.
- `apps/api/test/session-csrf-concurrency.test.ts` is a proper Vitest test for real SessionService and an in-memory Prisma fixture. **NOT executed** without NestJS/Vitest dependencies; no claims of database concurrency qualification.
- `scripts/qualification/phase1-3-preflight.mjs`: 5 PASS, 0 FAIL, 9 BLOCKED, including real full lockfile and runtime.
- `scripts/qualification/phase1-4-6-gates.mjs`: source checks pass, 8 live qualification gates BLOCKED.

## External security references (research context, not evidence of tests)

- OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- Vercel SPA deployment and Vite environment variables: https://vercel.com/docs/frameworks/frontend/vite and https://vercel.com/docs/environment-variables
- Vite public build-time environment variable rules: https://vite.dev/guide/env-and-mode

## Rollback and continuity

No schema change; rollback is a Git revert of this dedicated security checkpoint if regression evidence demands it. Reverting resurrects the known concurrent-CSRF failure, therefore a production rollback requires risk review, not an automatic release toggle. The Phase 1 master, Git history and preserved original archives remain authoritative.
