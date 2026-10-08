# TwiPay Phase 1.3 — Toolchain, Prisma & Disposable Database Qualification

**Status: PARTIALLY IMPLEMENTED, RUNTIME BLOCKED — NOT PRODUCTION QUALIFIED**

## Scope and verified starting point

- Phase 1.1/1.2 integration branch and full Git history retained. Starting source HEAD: `e45a5dcc68b9d8ae45a8bd80fafcd2bbca5c4e02`.
- **19 pnpm workspace packages** (five apps, fourteen packages), plus the root manifest. The ErhaPay-derived `apps/customer-ui` is an active workspace package, not a discarded visual reference.
- Prisma ORM/client/driver adapter versions are pinned together at `7.10.0` and the existing five migration directories are present. Their SHA-256 fingerprints are recorded in `out/phase1-3-gates.json` whenever the preflight runs. Checksums **do not** prove SQL is valid or that migrations ran.
- Required Node 24 (`>=24 <25`) and pnpm `12.9.1` from the root manifest; `pnpm@12.9.1` was confirmed as published in the npm package listing. Do not silently substitute a different major version.
- No ledger migration, production credential, provider configuration, or financial feature flag was modified. The five original migration checksums are pinned in `docs/integration/PHASE13_BASELINE_MIGRATIONS.json` to detect silent changes during later batches.

## Implemented in this checkpoint

1. `scripts/qualification/phase1-3-preflight.mjs`: zero-dependency, read-only inventory of workspace names/links, pinned runtime, Prisma source, migration SHA-256, and actual root lockfile importer coverage. Emits machine-readable `out/phase1-3-gates.json`. `--check-lock` fails without all workspace importers; **this is only a structural check**, not lockfile provenance, dependency integrity or frozen-install proof.
2. `scripts/qualification/phase1-3-run-local.sh --prepare-lock`: runs only under Node 24 and exact pinned pnpm; asks pnpm itself to produce the lockfile with `pnpm install --lockfile-only --ignore-scripts --no-frozen-lockfile`. Review and commit its output; never hand-author it.
3. `scripts/qualification/phase1-3-run-local.sh --qualify`: requires an existing complete lockfile and clean non-production runtime without previously provided DB/provider secrets; performs frozen install; starts a **new, disposable** isolated PostgreSQL 18 and Redis 8 stack; verifies server versions; generates Prisma client, validates/deploys migrations; executes existing database and worker integration tests, repository and pnpm tests, typecheck and combined build. The Compose project is unique to each run; the stack has no real customer data and is deleted on exit.
4. `scripts/qualification/compose.phase1-3.yaml`: localhost-only test ports (15435/16382 by default), random per-run PostgreSQL password supplied by the shell script, ephemeral tmpfs data volumes, explicit healthchecks. No production provider calls.
5. `docs/integration/test/phase1-toolchain.test.mjs`: isolated regression tests for workspace completeness, partial lockfile rejection, Prisma source and migration fingerprints, sandbox controls and qualification script invariants.
6. CI workflows now check **lockfile importer coverage** before attempting `pnpm install --frozen-lockfile`; frozen installation remains the final authoritative dependency check.

## Actual results in this execution environment

Environment: Node `v22.16.0`, Corepack `0.32.0`, **no installed pnpm**, Docker, PostgreSQL, Redis or suitable network access. Attempting to run pinned pnpm through Corepack failed to download its package from the registry. An installation or a real combined lockfile cannot be produced here.

`node scripts/qualification/phase1-3-preflight.mjs` reports:

| Phase 1.3 gate | Result |
|---|---|
| Workspace references | PASS |
| Pinned package-manager manifest | PASS |
| Prisma adapter/configuration source shape | PASS |
| Five migration files and SHA-256 inventory | PASS |
| Original five migration hashes unchanged | PASS |
| Genuine full workspace lockfile | BLOCKED (missing) |
| Node 24 / exact pnpm 12.9.1 | BLOCKED |
| Docker Compose | BLOCKED |
| Frozen install | BLOCKED |
| Prisma generate/validate/deploy | BLOCKED |
| PostgreSQL integration | BLOCKED |
| Redis/BullMQ integration | BLOCKED |
| Full workspace build | BLOCKED |

No `pnpm-lock.yaml` was invented; no Prisma migrations or real financial tests were claimed as completed.

## Execute in the verified developer workstation

Run in **Git Bash/WSL or a POSIX terminal**, with internet, Node 24 and Docker installed, from the repository root:

```bash
corepack enable
corepack prepare pnpm@12.9.1 --activate
bash scripts/qualification/phase1-3-run-local.sh --prepare-lock
# Review pnpm-lock.yaml and commit it to this existing integration branch.
node scripts/qualification/phase1-3-preflight.mjs --check-lock
bash scripts/qualification/phase1-3-run-local.sh --qualify
```

The qualification script explicitly refuses a shell containing application/provider credentials. Run it in a fresh terminal, not one configured for development/production operations. It creates only disposable localhost infrastructure and leaves live money movement disabled. Use repository review before promoting any generated lockfile.

Do not run Prisma's `migrate reset`, database `db push --accept-data-loss`, or production provider transactions during this phase. If any test fails, capture the command and sanitized failure details, fix the specific defect with regression coverage, then rerun the whole qualification path.

## Release classification and next gate

**Phase 1.3: SOURCE-TOOLING READY / REAL RUNTIME QUALIFICATION BLOCKED.**

Phase 1.4 (clean builds and CI) and 1.5 (full stack startup) cannot be marked passed until the above commands genuinely succeed. Backend OIDC Google authentication and mandatory server-enforced transaction PIN remain future Phase 3/4 deliverables, not current capabilities.
