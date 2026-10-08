# ADR 018 — Test Suite Isolation, Vitest Consolidation, and Environment Hardening

**Status:** Accepted

## Context
1. **Runner Fragmentation:** Unit and integration tests in `@twipay/api` and `@twipay/worker` were executed by `vitest`, but several test files were originally written with Node.js built-in `node:test` runner syntax. Vitest was unable to detect test suites in those files, causing suite failures.
2. **Deterministic Unique Constraints:** Multi-run qualification tests against a persistent PostgreSQL test container failed due to static SHA256 / 64-character hash strings colliding across subsequent runs on unique database indices (`sessions_tokenHash_key`, `mfa_recovery_codes_codeHash_key`, `event_tickets_credentialFingerprint_key`).
3. **Environment Sourcing & Secrets Security:** Sourcing JSON config objects (`TICKET_SIGNING_KEYS_JSON`) from `.env` in shell environments stripped unquoted double-quotes, corrupting JSON parsing during ticket checkout. Furthermore, repository security invariant checks (`scripts/repository-security-check.mjs`) failed when `.env` existed in local development workspaces even when ignored by git.

## Decision
1. **Vitest Consolidation:** All test files in `@twipay/api` and `@twipay/worker` use `vitest` assertions and test primitives (`describe`, `test`, `it`, `expect`). Test scripts in `package.json` load the root `.env` via `node --env-file=../../.env ./node_modules/vitest/vitest.mjs run` to guarantee that backing service credentials and encryption keys are populated without shell-dependent dependencies.
2. **Per-Run Hash Derivation:** Database and API integration test fixtures generate cryptographic hashes dynamically keyed by run timestamps (`crypto.createHash('sha256').update(\`${suffix}-${seed}\`).digest('hex')`) ensuring total test isolation across repetitive test runs against live databases.
3. **Safe Environment Variable Quoting:** All JSON configuration strings in `.env` (such as `TICKET_SIGNING_KEYS_JSON`) are enclosed in single quotes to guarantee RFC-compliant JSON parsing regardless of whether the file is parsed by Node.js or POSIX shells.
4. **Git-Aware Security Check:** `scripts/repository-security-check.mjs` verifies whether `.env` is tracked in git via `git ls-files --error-unmatch .env` rather than flagging its existence on local developer disks.

## Consequences
- 100% test pass rate across all 32 workspace tasks via `pnpm test`.
- Repository invariant checks pass cleanly for both CI and local developer workstations.
