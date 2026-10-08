# TwiPay Batch 5 — Task 8 application and E2E readiness (2026-10-08)

## Source and custody
Starting committed HEAD `1a3e123f6363ffc80ad2e4560f57120fa9c2e0b2`, `batch-04-handoff`; Task 7 WIP archive SHA-256 `9ca6286415d2c216dfad5ece889dd93b673dea12ff352f33ef6c5b5275d6a2eb` verified before extraction into isolated Task 8 working directory. Starting status: 74 entries; all previous WIP preserved. No commit or release tag authorized for this interim task.

## Application inventory
| Runtime | Entrypoint | Scripts | Existing tests |
|---|---|---|---|
| Customer web | `apps/web/app`, Next.js 16 | dev/build/lint/typecheck/test | `apps/web/test/product-surface.test.mjs`, `tests/e2e/release-security.spec.ts` |
| Admin web | `apps/admin/app`, Next.js 16 | dev/build/lint/typecheck/test | `apps/admin/test/operations-surface.test.mjs` |
| API | `apps/api/src/main.ts`, NestJS/Fastify | dev/build/lint/typecheck/test | API Vitest suites, release-security Playwright API flow |
| Worker | `apps/worker/src/main.ts`, BullMQ | dev/build/lint/typecheck/test/integration | pure recovery sweep test, Redis integration file |
| Cross-app browser | `playwright.config.ts`, Chromium | root `e2e` | `tests/e2e/release-security.spec.ts`; new `browser-surface.spec.ts` |

## Confirmed defect and correction
`scripts/wait-for-stack.mjs` previously declared the stack ready for any HTTP status below 500, including 404, 401, and 403 responses. This could mask a wrong health route, unavailable authentication, or an incorrectly wired deployment. Added `scripts/stack-readiness.mjs` with exact 2xx/3xx status classification, a per-target timeout and bounded individual requests; the wrapper now tests all targets and refuses HTTP errors. New `scripts/test/stack-readiness.test.mjs` provides three executable regressions. HTTP redirect is currently classified as ready, but staging may require follow-up redirect-policy tightening depending on actual deployment targets.

## Added browser E2E definitions
`tests/e2e/browser-surface.spec.ts` checks visible registration/login controls, customer route existence and absence of session/JWT-style browser storage keys, and admin route existence with restricted CSP. It makes no real-money requests, carries no privileged test credentials, and is **not executed**. Existing `release-security.spec.ts` already defines MFA lifecycle, CSRF/origin, ownership/BOLA, organizer lifecycle, and CSP/API security checks; these are also **not executed** here. These tests do not cover every end-to-end transaction listed in the release specification. Production mocks/placeholder audit and full admin maker/checker browser flows remain open.

## Verification matrix (this isolated environment)
| Check | Command | Result | Meaning |
|---|---|---|---|
| Task 8 readiness helper | `node --test scripts/test/stack-readiness.test.mjs` | PASS 3/3 | Real Node 22 executable pure test |
| JS syntax | `node --check scripts/stack-readiness.mjs && node --check scripts/wait-for-stack.mjs` | PASS | Parser only |
| TypeScript syntax | `node scripts/typescript-syntax-check.mjs` | PASS 128 sources | Parser only, not TS typecheck |
| Repository security | `node scripts/repository-security-check.mjs` | PASS 337 text files at initial rerun | Repository pattern scan only |
| Architecture | `node scripts/architecture-check.mjs` | PASS | Static invariant scan |
| Financial | `node scripts/financial-invariant-check.mjs` | PASS | Static invariant scan |
| Services/events | `node scripts/services-events-invariant-check.mjs` | PASS | Static invariant scan |
| Product/operations | `node scripts/product-operations-invariant-check.mjs` | PASS | Static invariant scan |
| Production hardening | `node scripts/production-hardening-invariant-check.mjs` | PASS | Static invariant scan |
| Reachable Git history secrets | `node scripts/git-history-secret-check.mjs` | PASS | Defined history secret patterns only |
| Whitespace | `git diff --check` | PASS | Existing tracked diff only |
| Genuine `pnpm install --frozen-lockfile` | n/a | BLOCKED | Node 24, pnpm and genuine `pnpm-lock.yaml` unavailable |
| Prisma generate/PG18 migration | n/a | BLOCKED | PostgreSQL/pnpm/Prisma unavailable |
| Redis worker integration | n/a | BLOCKED | Redis/pnpm unavailable |
| Strict typecheck, lint, all tests and production builds | n/a | BLOCKED | Dependency graph unavailable |
| Chromium browser E2E | n/a | BLOCKED | Built web/admin/API and Playwright browser unavailable |
| Docker start/image smoke | n/a | BLOCKED | Docker unavailable |
| Provider sandbox/staging | n/a | BLOCKED | No authorized provider/staging connections |

## PC / CI qualification commands (run only after dependency setup)
1. Install supported Node 24 and pinned pnpm; generate a **genuine** lockfile via `pnpm install` with trusted registry access, commit it only after review; use frozen installation in CI.
2. Provision disposable PG18 and Redis with `docker compose up -d postgres redis`, local-only secrets in `.env` and a test DB.
3. Run `pnpm db:generate`, the documented Prisma migration deploy/upgrade tests, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and package DB/worker integration commands.
4. Run `pnpm build`; start web/admin/API using configured local test environment; `node scripts/wait-for-stack.mjs`, then `pnpm exec playwright install chromium` and `pnpm e2e`.
5. Capture exact process versions, commands, service logs, database concurrency, provider sandbox evidence, accessibility and adverse outcomes. Do not mark unexecuted tests PASS.

## Carry-forward risks
- No proof browser MFA, cookie/cross-origin behaviors, CSP/nonces or real API responses match test expectations; Playwright failures must be investigated, not masked.
- Auth/session rotation, finance maker/checker, DB locks, Redis recovery, provider UNKNOWN are not qualified by pure/browser smoke definitions.
- The newer source changes remain uncommitted with original Batch 4 HEAD; preserve archive and do not create production release tag.
- Release flags `events.refunds=false`, `operations.organizer_payouts=false` remain unapproved for activation. No live configuration values were inspected.

**Task 8 status: SOURCE TEST PREPARATION AND READINESS FIX COMPLETED; FULL APPLICATION/E2E/BUILD QUALIFICATION BLOCKED.**
