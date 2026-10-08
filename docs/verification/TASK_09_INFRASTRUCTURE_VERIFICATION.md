# Task 9 — infrastructure source audit and unqualified runtime gates

Date: 2026-10-08. Baseline: `1a3e123f6363ffc80ad2e4560f57120fa9c2e0b2` (`batch-04-handoff`), with preserved Tasks 1–8 uncommitted changes. **Not production-qualified.**

## Reviewed boundaries

- Four Dockerfiles: web, admin, API and worker; separate runtime commands and non-root users are declared, but the runtime stages copy the complete build tree (including build-time dependencies), so image minimization and container-vulnerability qualification remain open.
- `compose.yaml`: local PostgreSQL 18 and Redis 8 with Docker-managed named volumes, local development-only password, and health probes.
- `infrastructure/cloudflare/README.md`: DNS, Full (strict) TLS, WAF/DDoS, bot rules, admin restrictions and authenticated cache bypass are instructions, **not evidence of activated Cloudflare rules**.
- `infrastructure/railway/README.md`, `docs/deployment/{production,staging,environment-variables,backup-restore-rollback}.md`: portable four-service deployment model, managed Postgres/Redis and explicit migration/promotion guidance. No live account/hosting configuration verified.
- `.dockerignore`, workflow files, package scripts, Node pin files and health/readiness entrypoints were inspected for release dependencies.

## Confirmed defects and narrow source fixes

1. `compose.yaml` published PostgreSQL/Redis on all host interfaces (`5432:5432`, `6379:6379`). Changed them to `127.0.0.1` bindings for developer-host access only. These are still dev-only services and must not be directly publicly exposed.
2. PostgreSQL 18 official image stores `PGDATA` at `/var/lib/postgresql/18/docker` and expects persistent volumes mounted at `/var/lib/postgresql`, not the pre-18 `/var/lib/postgresql/data` directory. Changed the volume target. Official image documentation: https://hub.docker.com/_/postgres . **Existing volumes must be backed up and migrated intentionally; do not discard prior data or treat a changed mount target as an automatic migration.**

No provider/ledger/session financial code changed. High-risk `events.refunds` and `operations.organizer_payouts` remain unapproved and must stay false.

## Verification record

| Gate | Status | Scope / evidence | Remaining action |
|---|---|---|---|
| Task 8 SHA-256 input | PASS | Matched expected `eaa75d289467eff80775bdb37271b25c06445b4c06ce60f0f683d106d274e07c` | None |
| Git baseline and WIP | PASS | HEAD/tag and 76 status entries inspected before edits | Preserve archive |
| Compose loopback and PG18 path | PASS (static only) | Exact configuration assertions | Docker compose config + persistence/restart test |
| Repository syntax/security/architecture/financial scanners | See attached check log | Real invoked Node commands | Run full runtime gates |
| Node 24 | BLOCKED | Host has Node 22.16.0 | Install Node 24 LTS |
| pnpm lock/install | BLOCKED | pnpm and genuine lockfile absent | Legitimate dependency installation and lockfile generation |
| Docker image build and compose startup | BLOCKED | Docker binary absent | Build and test all four Dockerfiles |
| PostgreSQL 18/Redis migration, persistence, queue | BLOCKED | No running service/binaries | Verify persisted restart, migrations, queue behavior |
| Cloudflare WAF/TLS/admin/caching | BLOCKED | No production account/environment evidence | Apply and inspect settings in authorized staging account |
| Hosting/proxy trust/health/migrations/rollbacks | BLOCKED | No deployed staging environment | Stage and verify end-to-end |
| Container/SBOM/vulnerability scans | BLOCKED | No images/dependency installation | CI/runtime qualification |

## Deployment-specific operational warnings

- Do not expose Redis/PostgreSQL publicly in production; local compose is not a production deployment definition.
- The four Docker builds intentionally fail until a genuine `pnpm-lock.yaml` is committed; never fabricate one.
- Container images currently copy the entire build directory, including development packages, not yet minimized. Review after a real pnpm install and builds; do not blindly prune Prisma/native/runtime dependencies.
- Verify Docker/Node/PNPM compatibility and health endpoints; no build or container smoke is claimed here.
- Configure `twipay.co`, customer/admin/API origins, TLS, CORS and CSP using real account values only in secure deployment settings.
- Keep provider webhook signatures and replay controls independent of browser CSRF and Cloudflare challenges.
- Confirm Postgres migration role and runtime role are separated in production, and verify backup/restore and forward-fix migration plan.
- Confirm image digests, deployment rollback and staging soak before production activation.
