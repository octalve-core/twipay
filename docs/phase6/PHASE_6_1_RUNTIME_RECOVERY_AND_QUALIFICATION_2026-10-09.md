# TwiPay Phase 6.1 — Runtime recovery and release-qualification evidence

**Date:** 2026-10-09, Africa/Lagos
**Starting authority:** existing Coov Technologies master ZIP at Git HEAD `88710a84cc23d1f4a9dd37828ed56aa6376b4eb9` (branch `phase3/low-friction-contact-20261009`, clean).
**Status:** Phase 6 tooling/CI preparation and isolated offline verification; **NOT a full runtime build or approved release**.

## Actual evidence gathered in this runner

| Check | Evidence | Assessment |
|---|---|---|
| Latest master ZIP + embedded Git | HEAD/branch/clean status; `git fsck` | PASS; no rebuild from an old source |
| Full historical regression | Node 22.16.0 `--experimental-strip-types` Node test runner | 433/433 passed before Phase 6; new Phase 6 tests also passed |
| Code/design/security/source invariants | `npm run test:repo` | Passed; 491 TypeScript files syntax-scanned; 123 original ErhaPay visual assets preserved (69 exact bytes, 54 LF-normalized SVG, 0 material changes) |
| Node 24 / pinned pnpm | `node --version` = 22.16.0; `pnpm` absent | BLOCKED |
| Registry retrieval | DNS lookup for `registry.npmjs.org` failed | BLOCKED; no package install attempted |
| Genuine frozen lockfile | `pnpm-lock.yaml` absent | BLOCKED; never invent or import a historical lockfile |
| PostgreSQL 18 / Redis 8 / Compose | No installed binaries/containers | BLOCKED; no migrations run |
| Real provider email, OIDC, payments or ticketing | No authorized credentials and no sandbox runtime | NOT TESTED |
| Browser screenshot parity and accessibility | No Node 24 built customer application, API or browser runtime | NOT TESTED |

## Engineering work in Phase 6.1

- Added a reusable `test:offline-regression` script covering the original migrations, ErhaPay design, all integration checks, Phase 3, Phase 4, Phase 5, Phase 6, original ticket-security, operations and stack-readiness tests. Wired it into the normal CI workflow and the isolated local qualification runner so later feature tests cannot silently disappear from release CI.
- Added a **manual**, intentionally **non-deploying** `phase6-qualification.yml` workflow that requires Node 24, the exact pnpm version, real frozen dependency installation, and independent disposable PostgreSQL 18/Redis 8 integration and customer browser smoke checks. It refuses financial activation and uploads diagnostic evidence. Its source presence does **not** mean this workflow has run remotely or passed.
- Added `phase6-release-evidence.mjs` to emit Git identity, migration source SHA-256 values, runtime prerequisite states and an explicit `NOT_APPROVED` release decision. Even if all prerequisites appear ready, its nine runtime categories remain `NOT_QUALIFIED` until independently executed and reviewed.
- Adjusted the local runner to accept an explicitly `false` high-risk flag from CI while rejecting `true` or malformed values; it still refuses real provider secrets or unsafe database targets.
- Corrected one stale source qualification message which had claimed Google OIDC and PIN were not implemented; they exist at the **source-contract** level but are not live-provider/runtime qualified.

## Exact authorized qualification sequence

Use a **trusted isolated disposable machine** with network access, Node 24.21.0, Corepack, Docker Compose, and no production `.env` files, banking data or credentials. Never run these tests against production endpoints.

1. In the exact latest committed master, run `corepack enable`, verify `node --version`, then `corepack pnpm --version`. Use the repository's `packageManager` version; never disable Node engine checks.
2. To generate the **only acceptable lockfile**, execute `bash scripts/qualification/phase1-3-run-local.sh --prepare-lock`. Review the real resolution, any peer warnings, package conflicts and installer scripts; commit the resulting `pnpm-lock.yaml` **in the same Git master**. This preparation alone is not a passed frozen-install test.
3. After clean review, execute `bash scripts/qualification/phase1-3-run-local.sh --phase3-1` for disposable Postgres/Redis, Prisma and real contact/auth API checks. A true database test must show the exact PostgreSQL major version and migration deployment, not just TCP reachability.
4. Execute `bash scripts/qualification/phase1-3-run-local.sh --smoke` for real worker/API/admin/customer builds and browser journeys, with the financial flags off.
5. Trigger the *manual* GitHub Actions workflow **Phase 6 isolated qualification (no release)** on the same Git SHA; retain machine-readable logs, full dependency audits, package SBOM, browser traces and security scanner results. The workflow must fail if the pinned lockfile or any runtime gate is missing.
6. Separately authorize and execute isolated sandbox email, Google OIDC and payment-provider tests, including webhooks, fee matching, deposit identity conflicts, transfer/refund unknown outcomes, idempotent replays and reconciliation; sandbox credentials are never placed in the repository or general offline CI.
7. Perform independently reviewed real browser accessibility/original ErhaPay visual parity and security assessment (MFA, CSRF, RBAC, CSP, DAST); obtain formal risk/compliance and release approval before enabling any money or admission service.

## Remaining hard blocks and release decision

- Mandatory real runtime: Node 24 frozen install/build/typecheck/lint; PostgreSQL 18 migrations, rollback and row-lock concurrency; Redis 8 retry/worker recovery; real HTTP session/contact/MFA/PIN/security; controlled Resend and Google OIDC; approved Paystack/Monnify/VTpass/Mono sandboxes; ticket QR admission concurrency; active ErhaPay browser/visual/accessibility; infrastructure/cookies/headers/CORS/CSP/rate-limit review; independent release signoff.
- No exact production provider success, balance, fee, wallet activation, ticket issue or screenshot parity can be inferred from these source checks.
- All high-risk financial feature flags, ticket publishing, purchase and admission flags remain default-off.
- **Release decision: NOT APPROVED.** This checkpoint improves verifiability; it does not close the external runtime gates.
