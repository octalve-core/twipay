# Post-handoff local qualification — 2026-10-08

## Baseline

Original artifact `TWIPAY_BATCH_05_RELEASE_CANDIDATE.zip` SHA-256:
`bccda36829855733c8333d7bdefe0b9ff447be5b60e9e7060e7a16e9acb3a0e4`.
Baseline commit `9dcd5e543222d8fd95129bf31fe7469097a4585b` (`twipay-v1.0.0-rc.1`). Unmodified source at audit start.

## Executed successfully (PASS)

From the repository root on Node v22.16.0 (not the release Node 24 target):

- `node scripts/typescript-syntax-check.mjs` — PASS, 128 sources.
- `node scripts/repository-security-check.mjs` — PASS, 347 text files.
- `node scripts/architecture-check.mjs` — PASS.
- `node scripts/financial-invariant-check.mjs` — PASS.
- `node scripts/services-events-invariant-check.mjs` — PASS.
- `node scripts/product-operations-invariant-check.mjs` — PASS.
- `node scripts/production-hardening-invariant-check.mjs` — PASS.
- `node scripts/git-history-secret-check.mjs` — PASS, reachable history.
- `node --experimental-strip-types --test apps/api/test/risk-rate-policy.test.mjs apps/worker/test/recovery-sweep.test.mjs scripts/test/stack-readiness.test.mjs` — PASS, 13/13.
- `node --check packages/database/test/production-hardening.integration.test.mjs` — PASS syntax only.
- `git diff --check` — PASS.
- `git fsck --no-reflogs --connectivity-only` — returns success with historical dangling objects (not missing reachable objects).

## Attempted, but BLOCKED

- `npm view pnpm version --fetch-retries=0 --fetch-timeout=10000` — FAIL with DNS `EAI_AGAIN registry.npmjs.org` (external toolchain retrieval unavailable).
- Genuine `pnpm install` / lockfile generation and frozen install — BLOCKED; pnpm is not available, registry lookup failed, repository contains no genuine lockfile.
- Node 24 release compilation, full lint/typecheck/build, Prisma generate/migrate, PostgreSQL 18, Redis/BullMQ, container scans, Playwright browser E2E, provider sandbox tests and staging — BLOCKED by unavailable toolchain/infrastructure/credentials.

## Test invocation clarification

The default Node invocation of the isolated `.mjs` tests failed because they import `.ts` source requiring Node 22 experimental type stripping. The corrected invocation with `--experimental-strip-types` passed 13/13. This is **not** evidence of running the Node 24 release toolchain.

## Security and release decision

The executed checks reveal no additional source-level defect in their coverage. They do not prove that the implementation is vulnerability-free or production-ready. Do not publish live customer transactions. `events.refunds=false` and `operations.organizer_payouts=false` remain mandatory fail-closed requirements.

**RELEASE CANDIDATE — NOT YET PRODUCTION QUALIFIED**

Required next actions are in `docs/release/PC_AND_STAGING_QUALIFICATION.md` and root `BATCH_05_VERIFICATION.md`; resolve all blocked gates using real Node 24/pnpm, PostgreSQL 18, Redis, Docker, provider sandboxes and an isolated staging deployment. Never put production secrets in Git.
