# TwiPay Phase 6.3 — Authentic dependency bootstrap, full-workspace build and database qualification

**Date:** 2026-10-09 (Africa/Lagos). **Status: PARTIALLY EXECUTED / BLOCKED FOR THE REQUIRED RUNTIME. PRODUCTION RELEASE IS NOT APPROVED.**

## Baseline and objective

- Authoritative starting Git HEAD: `d791cdb7e5c8e03262bc6a6bfc70a64d4fb7ba95`; branch `phase3/low-friction-contact-20261009`; preserved full Git history and all 123 original ErhaPay assets.
- Objective is genuine Node 24.21.0 and pnpm 12.9.1 resolution, authentic complete `pnpm-lock.yaml`, frozen install, Prisma generation and migrations on PostgreSQL 18, Redis 8 worker tests, backend/customer UI/admin/worker full semantic typechecks/builds, and confirmed defect corrections.
- **None of these complete-network/runtime qualifications was executed successfully in the present container.** Do not describe this checkpoint as a completed full build, successful database migration, or financial release.

## Directly observed constraints in this environment

| Item | Observed evidence | Qualification |
| --- | --- | --- |
| Node | v22.16.0; target `24.21.0` from `.node-version` | BLOCKED |
| pnpm | `pnpm` executable missing; root requests `pnpm@12.9.1` | BLOCKED |
| Authentic lockfile | No root `pnpm-lock.yaml` present | BLOCKED |
| Registry | `registry.npmjs.org` failed to resolve through DNS | BLOCKED |
| PostgreSQL 18 | No `psql`, Docker or running database fixture available | BLOCKED |
| Redis 8 | No `redis-server` or running Redis fixture available | BLOCKED |
| Root preflight | 5 PASS, 0 FAIL, 9 BLOCKED | Not certification |
| Full workspace typecheck/build | Dependencies/Prisma unavailable; not run | BLOCKED |
| Actual browser tests and provider sandboxes | Not run | BLOCKED |

Evidence: `docs/phase6/evidence/phase63-runtime-attempts-2026-10-09.txt` and `phase63-environment-preflight-2026-10-09.txt`.

## Checks actually executed successfully

- **453/453** dependency-light source and mocked behavioral tests passed, adding four source-policy regression tests for the Phase 6.3 workflow.
- TypeScript syntax, repository security, architecture, financial, services/events, operations, production hardening, ErhaPay design inventory and full reachable Git history secret-pattern checks passed.
- A static source import check independently confirmed **695 relative TypeScript imports resolve** and **998 examined external imports have declared dependencies**. This was a source inventory and is not a TypeScript semantic compile or dependency resolution proof.
- The dependency-free `@twipay/contracts`, `@twipay/ledger` and `@twipay/operations` packages were actually compiled with globally available TypeScript 5.8.3 on Node 22.16.0, and their generated ESM `dist/index.js` modules imported successfully. **All other packages and the full Node 24 build remain unverified.**
- No source financial execution, ledger, provider activation, UI visuals, Prisma model, migration, or authorization paths were changed in this checkpoint.

Evidence: `docs/phase6/evidence/phase63-offline-2026-10-09.txt`, `phase63-repo-checks-2026-10-09.txt`, `phase63-partial-build-2026-10-09.txt`.

## Code/CI change delivered

**New read-only, manual GitHub Actions workflow:** `.github/workflows/phase6-3-dependency-bootstrap.yml`.

This separate bootstrap workflow (not a production release workflow) will, **only after somebody pushes the Git branch and explicitly dispatches it in an authorized GitHub repository with registry access**:

1. Refuse an existing lockfile or any provider secrets and require the precise pinned Node/pnpm; keep all high-risk flags OFF.
2. Resolve an **authentic** pnpm lockfile from the npm registry using `pnpm install --lockfile-only --ignore-scripts --no-frozen-lockfile` (never synthesize one), inspect all 19 workspace importers, record its SHA-256 and attempt a genuine `pnpm install --frozen-lockfile`.
3. Generate Prisma client, validate schema, apply **all 18** migrations to isolated PostgreSQL 18, verify migration status, and run database tests. Execute Redis 8 worker integration.
4. Run actual root `pnpm typecheck`, `pnpm lint`, `pnpm build`, dependency-backed `pnpm test`, the existing **full 453-test offline suite**, source scanners, customer bundle betting exclusion, and Playwright test discovery.
5. Save the **generated** lockfile as a reviewable short-lived artifact together with logs, even if the build fails (where available); use strict `pipefail` to refuse false-green output.
6. Never deploy, activate provider flags, publish events, admit tickets, or claim financial certification.

`docs/phase6/test/phase6-3-bootstrap.test.mjs` covers the workflow's fail-closed policy. This workflow **has not been dispatched** from this container and its outcomes must not be presumed.

## Actions on a trusted connected runner

1. Place this complete Git repository at the verified commit on a permitted GitHub remote, without replacing its original ErhaPay customer application.
2. Run **Actions → Phase 6.3 authentic lockfile and disposable full builds (no release) → Run workflow**. Download `phase63-authentic-lockfile-and-build-evidence`.
3. Review the generated `pnpm-lock.yaml`: workspaces, registries, transitive packages, integrity hashes, post-install build approvals, licenses and security advisories. **Commit the reviewed real lockfile in a new reviewable Git commit** (the workflow intentionally has no write permissions).
4. Rerun the regular frozen-lockfile CI and Phase 6 workflow on a trusted runner. Correct compiler, lint, migration or integration failures **from their actual logs**, not by relaxing checks or guessing fixes; do not mark unexecuted items PASSED.
5. After the full stack compiles, independently execute API/browser user journeys, database contention/reversals, provider sandboxes and security/compliance go/no-go checks before any production enablement.

## Risk and release decision

**P0 OPEN:** no authentic lockfile, Node 24 full workspace builds, Prisma migration 0018 PostgreSQL execution, Redis worker runtime or financial concurrency proof. **P1 OPEN:** actual Playwright/browser UI parity, provider sandbox and transaction end-to-end qualification. Source-only improvements from Phase 6.2 remain intact and gated.

**Decision: NOT APPROVED.** This Phase 6.3 repository is a more executable *qualification handoff*, not a production-ready application. Neither a fabricated lockfile nor a mock success should satisfy any release gate.
