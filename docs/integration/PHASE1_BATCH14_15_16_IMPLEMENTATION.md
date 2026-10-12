# TwiPay Phase 1.4–1.6 — CI, Full-Stack Startup, Security Controls

**Status: SOURCE-IMPLEMENTED; NODE 24/POSTGRES/REDIS/BROWSER QUALIFICATION BLOCKED. NOT PRODUCTION-READY.**

## Provenance and boundaries

- Base: existing Git-backed Phase 1.3 master at `f778d7e35015a0209f62753e27f8bb760f59aa0a`.
- Customer visual authority: **original ErhaPay React/Vite** app, `apps/customer-ui`. The simplified `apps/web` Next app remains a reference; it does not qualify our customer UI and no old source was discarded.
- No Prisma migration, ledger write path, provider integration, original customer design tokens or original image assets were modified in this batch.
- Google OIDC authorization-code login and a **mandatory server-enforced transaction PIN** remain binding Phase 3/4 requirements. Neither is implemented by Phase 1.4–1.6 source testing.
- No production financial capability is enabled. Refunds and organizer payouts remain OFF.

## 1.4 — Clean build and CI wiring

- `.github/workflows/browser-e2e.yml` now builds and launches `@twipay/customer-ui` using Vite production preview at `127.0.0.1:3000`. `VITE_TWIPAY_API_URL` points to the isolated API at `127.0.0.1:4000` **before the Vite build**. It also launches the NestJS worker. Formerly this job started the simplified Next.js `@twipay/web` and could not test ErhaPay.
- `playwright.config.ts` selects the **real** ErhaPay-derived `tests/e2e/customer-ui/*.spec.ts`; original Next-specific tests retain their historical paths and a separate `playwright.legacy-web.config.ts` reference runner. They are **not counted as qualification of the ErhaPay UI**.
- All six sandbox money/ticketing backend gates, all five customer Vite gates and high-risk release approval default explicitly to `false` in CI.
- CI runs isolated source tests for existing Batches A–F and Phase 1 before full runtime tests. It saves the source gate JSON as an artifact.
- `apps/customer-ui` has a TypeScript checking command; `apps/worker` has a compiled-production start command.
- **BLOCKED:** no committed complete pnpm workspace lockfile; Node 24/pnpm unavailable in this environment. Consequently no frozen install, package resolution, actual lint/typecheck/full build was executed here.

## 1.5 — Full-stack startup smoke

- The existing disposable `phase1-3-run-local.sh` accepts `--smoke` in a Node 24/pnpm 12.9.1/Docker environment. It refuses application `.env` files and pre-existing DB/provider credentials; creates a fresh PostgreSQL 18/Redis 8 project with randomized disposable credentials, generates disposable session/PII/QR crypto secrets, and sets all provider-money flags to OFF.
- After the frozen install, real Prisma generation and migrations, DB/Redis tests and all builds, it starts the API, reconciliation worker, ErhaPay Vite preview and separate admin, using localhost ports; verifies API+admin HTTP readiness and **checks the ErhaPay `<div id="root">` with TwiPay title** so an unrelated Next app cannot pass as the customer UI.
- The runner verifies the worker stays alive and launches the read-only ErhaPay Playwright suite. Containers are destroyed on exit. It refuses occupied app ports rather than killing unrelated services.
- **BLOCKED:** script cannot run in the current execution environment: Node 22, no pnpm, no Docker, no real backing services, incomplete lockfile. Readiness and refusal logic were tested with isolated Node tests, not a running stack.
- Note: `vite preview` is for *testing the production build locally*, not for production serving. The actual production customer hosting, verified CSP and image scanning are separate prelaunch gates.

## 1.6 — Cross-system security verification preparation

- Added real-app anonymous browser tests for customer shell identity, unauthenticated wallet/money mutations and malicious Origin. They must be executed against a running isolated API before being considered PASS.
- Strengthened Fastify CORS callback: denied Origins no longer raise a misleading application exception/HTTP 500; they receive no CORS permission, and the existing request-security guard rejects unsafe requests with 403.
- The on-demand ZAP DAST workflow now refuses arbitrary targets and requires a **repository variable `TWIPAY_APPROVED_STAGING_HOST`**, matched as an **exact public HTTPS hostname**. No hostname was invented. Arbitrary or internal scans are prohibited.
- Recorded SHA-256 for 123 source/public image files (image extensions included by the inventory rule). They remain byte-identical to the pre-change source. This is not a pixel-perfect browser comparison nor an assertion about every original binary asset extension.
- The 1.4–1.6 source gate produces `out/phase1-4-6-gates.json`. It reports source checks separately from blocked runtime/security gates; no flags can be turned on by this test runner.
- Known unresolved **CSRF concurrency bug:** `GET /v1/auth/csrf` still rotates the only stored hash; simultaneous mutations can invalidate each other's token. Full fix with real concurrent-session tests belongs in Phase 3 and **must block production authorization sign-off**.
- Other blocked security gates: qualified Vite customer hosting with proven CSP, authenticated BOLA/RBAC journeys, user impersonation and account/session step-up, SQL/database concurrency, worker retries, real provider sandbox settlement, OIDC and PIN requirements, and independent penetration testing.

## Execute in the developer's clean machine/authorized CI

Use one checked-out repository with the genuine committed complete `pnpm-lock.yaml`, Node 24.21.0, pnpm 12.9.1, and Docker Compose. From a **clean terminal with no existing .env files or provider credentials**, run:

```bash
node scripts/qualification/phase1-3-preflight.mjs --check-lock
node scripts/qualification/phase1-4-6-gates.mjs
pnpm test:isolated-regression
pnpm test:phase1 && pnpm test:phase1-3 && pnpm test:phase1-4-6
bash scripts/qualification/phase1-3-run-local.sh --qualify
bash scripts/qualification/phase1-3-run-local.sh --smoke
```

The second shell run creates a **separate disposable** test DB/Redis. Neither test run should use a live customer database or production provider credentials. If the script returns an error, save only sanitized logs and do not bypass failed security gates. Browser screenshots require manual comparison with accepted original ErhaPay baselines.

Optionally trigger the reviewed GitHub Actions CI and Browser E2E workflows once the full lockfile has been committed. They run in a network-connected, isolated environment. Do not treat a GitHub check with `skipped` tests as an execution pass for those scenarios; capture test counts, skips, screenshots and service logs.

The on-demand ZAP security workflow additionally requires `TWIPAY_APPROVED_STAGING_HOST` to be set in repository variables, e.g. **to the real approved staging hostname**. It fails closed without that exact configuration. Never provide a third-party or production host.

## Release decision

No financial, identity, ticketing, provider, or admin release approval is granted by these source-only checks. Complete Node 24 builds, real DB/Redis integration, active ErhaPay browser tests and risk-specific security checks remain mandatory before Phase 1 can be closed.
