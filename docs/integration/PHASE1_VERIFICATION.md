# TwiPay Phase 1.1–1.2 — Verification and Remaining Gates

**Classification: SOURCE-RECONCILED DEVELOPMENT CHECKPOINT — NOT PRODUCTION QUALIFIED**

## Source status

- Starting base: `7868046893addc4bfa9384b19f474eb3428350ad` (Git-backed Batch F master).
- Working integration branch: `integration/phase1-developer-runtime-20261008`.
- Developer GitHub export was provided without `.git`; it was compared as a separate source tree, **not** merged using invented Git ancestry.
- 48 changed shared files were reviewed individually; 30 received selected developer fixes, 18 preserved the newer Batch F master implementation.
- 11 developer-only files: ADR 016–018 and Prisma CLI config brought in; incomplete root-only lockfile preserved for reference; local task journals retained in the original source snapshot pending credential review.
- Original ErhaPay: 460/460 file paths retained under `apps/customer-ui`, 132 modified during prior feature integrations, 123 checked visual files unchanged (this file-type-based count does not claim to cover all possible asset formats).
- Google authorization-code OIDC with PKCE and transaction PIN were accepted as binding Phase 3/4 requirements; **both remain unimplemented**.

## Executed verification in this environment

| Gate | Status | Evidence |
|---|---|---|
| Node built-in isolated source contract tests | PASS | 104/104 from Batch A–F, command in `scripts/qualification/batch-f-gates.mjs` |
| Phase 1 source reconciliation regressions | PASS | 8/8 from `node --test docs/integration/test/phase1-reconciliation.test.mjs` |
| TypeScript syntax | PASS | `node scripts/typescript-syntax-check.mjs` |
| Repository security scanner | PASS | `node scripts/repository-security-check.mjs` |
| Architecture invariant | PASS | `node scripts/architecture-check.mjs` |
| Financial invariant | PASS | `node scripts/financial-invariant-check.mjs` |
| Services/events invariant | PASS | `node scripts/services-events-invariant-check.mjs` |
| Product/operations invariant | PASS | `node scripts/product-operations-invariant-check.mjs` |
| Production hardening invariant | PASS | `node scripts/production-hardening-invariant-check.mjs` |
| Complete Node 24 compilation and package resolution | BLOCKED | Environment provides Node 22.16.0, no `pnpm` |
| Frozen clean workspace installation | BLOCKED | Developer lockfile is root-only, **no usable combined lockfile** |
| Prisma generate/migrate and Postgres 18 integration | BLOCKED | Docker and PostgreSQL 18 unavailable here |
| Redis/BullMQ integration | BLOCKED | Docker and Redis 8 unavailable here |
| Browser ErhaPay appearance and auth E2E | BLOCKED | No running combined customer/API stack |
| Provider sandbox, money-movement and ticket issuance | BLOCKED | Must remain gated OFF until isolated external qualification |
| Production release decision | BLOCKED | Mandatory runtime and provider/security gates incomplete |

## Critical non-regressions

- `DATABASE_URL` is mandatory in the NestJS runtime; the developer's hardcoded local DB password fallback was removed rather than copied.
- The six server-side sandbox flags and two high-risk feature flags remain default-off.
- The newer event quote checks, ticket QR redaction, idempotency protection and bank recipient verification remain intact.
- No application ledger schema or migration was modified in the code reconciliation aside from moving the Prisma 7 `datasource.url` CLI setting into `prisma.config.ts`.
- No new money movement or ticket issuing was activated.
- The `.env.example` values remain blank for secrets, and the local `.env` file must never be committed.

## Required Phase 1.3–1.6 tasks

1. On a verified Node 24 system install pnpm 12.9.1 from trusted packaging; regenerate a real root `pnpm-lock.yaml` covering all workspaces including `apps/customer-ui` (never handwrite), then clean-install with `--frozen-lockfile`.
2. Validate all builds and typechecks, including NestJS API worker-entry declaration output, Prisma client and worker compilation.
3. Set a **throwaway** `DATABASE_URL`, isolate PostgreSQL 18 and Redis 8, run migrations, database/Redis integration tests and financial concurrency tests. Ensure no production provider secrets or accounts exist in the test environment.
4. Run the real customer Vite app, admin and API; compare original ErhaPay screenshot baselines and test all role-specific journeys; correct only evidenced failures.
5. Reconcile any developer changes committed after the supplied GitHub ZIP when verified Git history is available.
6. Enable financial flags only via explicit security qualification and deployment approval; no implicit staging-to-production promotion.
