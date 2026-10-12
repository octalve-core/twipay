# TwiPay Phase 3.1 — additional runtime qualification attempt

**Date:** 2026-10-09 (Africa/Lagos)
**Authoritative starting HEAD:** `a6ea2fea4ef42674c5da01ddf7cf93a367e9f10c`
**Decision:** **REAL-RUNTIME QUALIFICATION NOT APPROVED**. All financial features remain default-off.

## Evidence verified from this checkpoint

The recovered Coov Technologies master ZIP was extracted in its own workspace. Its embedded Git HEAD was `a6ea2fea4ef42674c5da01ddf7cf93a367e9f10c`, on `phase3/low-friction-contact-20261009`, with an initially clean worktree. Source is ErhaPay-derived `apps/customer-ui`; API is NestJS/Fastify and data is Prisma 7/PostgreSQL. No old source archives were merged and neither ledger nor financial provider flags were modified.

A fresh **Node 22.16.0** isolated test run of all 24 source-only `.test.mjs` files in `docs/` and `scripts/` returned **235 passed, zero failed** (`evidence/runtime-2026-10-09/isolated-node22-tests.tap`). This is NOT Node 24 or database qualification.

The following source checks **all exited 0**: TypeScript syntax scanner, repository security, architecture, finance, services/events, product/operations, production hardening and ErhaPay design inventory. The inventory reports **329 preserved customer source files and 123 original visual assets, zero material asset changes**. New Phase 3.1 PostgreSQL and HTTP tests passed **Node 22 strip-types syntax parsing only**; they were NOT run against the actual API/database.

The read-only Phase 3.1 preflight exited **2** (blocked) and `scripts/qualification/phase1-3-run-local.sh --phase3-1` also exited **2**, refusing Node 22.16.0. This runner did not have Node 24, pinned pnpm, a generated `pnpm-lock.yaml`, Docker, PostgreSQL 18, Redis 8 or provisioned app dependencies. External npm-registry DNS was unavailable, and an attempted download of the official Node 24.21.0 binary failed. No installation, migrations or Resend delivery were performed.

## Added but NOT executed: real infrastructure tests

1. `apps/api/test/contact-verification.postgres.integration.test.ts` uses **three independent PrismaPg connections** and the real contact/notification services with a **network-free fake external email provider**. It verifies atomic challenge+encrypted-outbox persistence/rollback, HMAC persistence, five failed attempts, expiry, email changes, replay prevention, count limits, suspended-account denial, and **row-lock contention** for concurrent confirmations and resends with a deliberately held SQL user-row lock. Tests must run in the known disposable PG18 Compose fixture and refuse other database URLs.
2. `apps/api/test/contact-verification.http.integration.test.ts` launches the **actual compiled NestJS/Fastify server on 127.0.0.1:15401**, using the disposable PostgreSQL database, real opaque session/CSRF cookies, and its own decrypted local outbox to recover the email code. It checks short signup, restricted `/auth/me`, direct API denial, origin and CSRF enforcement, resend cooldown, wrong OTP, verification, session rotation, old-session rejection, replay denial, MFA-protected resources, and logout. It explicitly disables Resend and all high-risk financial toggles. **This does not prove inbox delivery, React visual parity or provider readiness.**
3. The EXISTING `scripts/qualification/phase1-3-run-local.sh` now accepts `--phase3-1`, adding the two new suites **after** real PostgreSQL 18 / Redis 8 version checks, Prisma migrations, the worker tests, full workspace tests/typechecks and builds. Its network-free disposable secrets are generated per run. Existing `--prepare-lock`, `--qualify` and `--smoke` options remain unchanged.

## Exact trusted-runner procedure (not performed here)

**Requirements:** isolated trusted Linux/macOS CI runner with Docker Compose, official Node **24.21.0**, exact `pnpm@12.9.1`, network access to the trusted package registry, and no production credentials or production `.env` files.

```bash
# Phase A: from this same Git master, create an AUTHENTIC lockfile only on a trusted runner
corepack enable
node --version
pnpm --version
bash scripts/qualification/phase1-3-run-local.sh --prepare-lock
# Review pnpm-lock.yaml (supply-chain changes and generated integrity hashes).
# Commit the reviewed lockfile to this master before claiming reproducibility.

# Phase B: after committing/reviewing the lockfile, in a fresh disposable checkout
bash scripts/qualification/phase1-3-run-local.sh --phase3-1
```

The runner refuses the wrong Node/pnpm, absent lockfile, missing Docker, environment files, pre-existing provider/financial credentials, occupied test ports, wrong PostgreSQL/Redis major versions, and non-disposable DB URLs. On exit it destroys the temporary Compose project and volumes.

## Still separate and NOT qualified

- Actual Resend sandbox acceptance **and** independent delivery to a controlled inbox (requires authorized `RESEND_API_KEY`, `RESEND_FROM` and mailbox access). The fake outbox/transport does **not** count as delivery. Never echo secrets, share arbitrary mailbox credentials, or claim ACCEPTED means DELIVERED.
- Node 24 frozen dependency install and real code typechecks/builds; Prisma 7 migration application and verification; actual PG row-lock and Redis worker results; live Fastify security results; browser/ErhaPay screenshots; provider sandbox validation. Each remains NOT EXECUTED in this run.
- Production qualification, live wallet movements and financial-flag activation are **not authorized**.

**Release gate:** Actual failing tests must be diagnosed from executable evidence, fixed narrowly in this SAME repository, and rerun. Do not merge outdated ZIPs or rebuild ErhaPay.
