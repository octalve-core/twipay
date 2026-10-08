# TwiPay Batch 5 — Task 5 Browser/API Security Verification

Date: 2026-10-08. Scope: source-layer browser/API hardening, not production security qualification.

## Source and preservation
- Baseline HEAD: `1a3e123f6363ffc80ad2e4560f57120fa9c2e0b2` (`batch-04-handoff`).
- Continued the actual Task 4 worktree; its preserved archive checksum matched `589ccf760aea5f855f7f91f4259fe6729d75b6f4b264e146cc94a6dee870daaa`.
- Tasks 1–4 remain uncommitted and retained. No production release tag created.
- No external specialist subagent executed; the review was performed with available repository tools.

## Source inspection
- `apps/api/src/main.ts`: exact CORS allowlist, Helmet, API headers, rate-limit registration.
- `apps/api/src/modules/auth/presentation/{request-security.guard.ts,session-auth.guard.ts,session-cookie.ts,auth.controller.ts,mfa.controller.ts}`: Origin, CSRF, authenticated sessions and cookies.
- `apps/api/src/modules/webhooks/{presentation/webhook.controller.ts,application/webhook.service.ts}`: raw payload, provider signature verification, inbox deduplication.
- `apps/api/src/platform/{http/risk-rate-limit.ts,logging/logger.ts,config/env.ts}`: endpoint policy, request logs, environment.
- `apps/web/proxy.ts`, `apps/admin/proxy.ts`, Next.js security headers, API clients.
- Controllers under `finance`, `services`, `events`, `operations`, `product` reviewed to establish actual mutation route shapes.
- Existing Task 4 authorization verification, security/threat docs, release security-gate definitions.

## Confirmed corrections
1. Fixed rate-limit classification: actual `POST /v1/finance/transfers` did not match the previous transfer pattern. Actual `POST /v1/services/purchases` and `POST /v1/events/checkout` are now explicit; PATCH privileged operations and product admin configuration now receive appropriate risk buckets.
2. Request log serializer previously recorded raw `request.url`, including query string. It now records pathname only and omits both query and fragment.
3. Added eight policy regression tests, including lookalike route rejection and privileged PATCH coverage.

## Executed verification (this environment; Node 22.16.0)
- `node --experimental-strip-types --test apps/api/test/risk-rate-policy.test.mjs`: **PASS, 8/8**. This tests the pure policy, not the running Fastify plugin.
- `node scripts/typescript-syntax-check.mjs`: **PASS, 127 source files**.
- `node scripts/repository-security-check.mjs`: **PASS, 328 inspected text files** (before adding this documentation).
- `node scripts/architecture-check.mjs`: **PASS**.
- `node scripts/financial-invariant-check.mjs`: **PASS**.
- `node scripts/services-events-invariant-check.mjs`: **PASS**.
- `node scripts/product-operations-invariant-check.mjs`: **PASS**.
- `node scripts/production-hardening-invariant-check.mjs`: **PASS**.
- `node scripts/git-history-secret-check.mjs`: **PASS, 278 tracked paths, full reachable patch history**.

## Explicit BLOCKED gates
- Node 24 / real pnpm dependency graph, typecheck, API builds and real Nest/Fastify runtime tests.
- Full CSRF/Origin/CORS attack tests, browser CSP behavior, cookie integration, BOLA, injection and session tests against a running stack.
- Real Redis-backed/distributed or deployed Cloudflare edge rate-limit proof.
- PostgreSQL transaction/race validation of Tasks 2–4, including privileges and active-user changes during sensitive transactions.
- Provider webhook sandbox/reconciliation, staging DAST, frontend leak verification against built bundles, live log output review.
- Runtime check that `@fastify/rate-limit` options and registration work with the pinned installed version; policy-only tests do not establish that.

## Residual risks / next work
- Task 4 expressly leaves provider routing, SKU mapping, feature flags, transfer and maker-stage transactional authorization outside proven session-row revalidation coverage.
- `/v1/auth/csrf` rotates CSRF state on GET; concurrent browser mutations and strict Origin/CSRF request behavior need real tests before changing that contract.
- Logging serializer now redacts query strings, but request body/error serialization must be tested with the real Pino runtime.
- Current Fastify rate limiter defaults to process-local memory; multi-instance production edge/Redis enforcement is a release gate.
- A privileged endpoint inventory is in `docs/verification/TASK_04_AUTHORIZATION.md`; this Task 5 source review is **not** a completed penetration test or blanket authorization approval.
- `events.refunds=false`, `operations.organizer_payouts=false` remain release-gated; live database values were not inspected.

## Classification
**TASK 5: TARGETED SOURCE HARDENING COMPLETED; FULL BROWSER/API AND DISTRIBUTED-RATE QUALIFICATION BLOCKED.**
**RELEASE CANDIDATE — NOT YET PRODUCTION QUALIFIED** (classification only: no candidate tag created).
