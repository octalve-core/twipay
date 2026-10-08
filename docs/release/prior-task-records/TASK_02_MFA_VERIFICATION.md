# TwiPay Batch 5 — Task 02 MFA verification (2026-10-08)

## Baseline and preservation
- Continuing Task 1 worktree (`main`, Batch 4 HEAD `1a3e123f6363ffc80ad2e4560f57120fa9c2e0b2`, `batch-04-handoff`). Do not reset uncommitted Batch 5 files.
- Task 1 complete repository snapshot remains available. Task 2 produces its own complete snapshot including `.git` and all tracked/untracked changes.

## Inspected
- `TWIPAY_NEW_CHAT_CONTINUATION_BRIEF.md`, `TASK_01_AUDIT.md`, ADR 014, `docs/api/mfa-and-sessions.md`.
- `packages/security/src/mfa.ts`, security primitive tests, MFA service/controller, session service/auth guard/session cookies, MFA schema/migration 0005, DB integration test.
- Existing Batch 1–4 source-of-truth review is recorded in Task 1 audit.

## Evidence-backed defects corrected in Task 2
1. Migration 0005's monotonic TOTP guard originally checked `NEW.lastAcceptedTimeStep IS NOT NULL`, which allowed an accepted timestep to be reset to NULL. Updated trigger to reject clearing or non-increasing accepted timesteps.
2. Migration 0005 now additionally rejects impossible pending/active timestamp combinations on UPDATE.
3. Recovery-code regeneration previously verified the factor in a transaction but did not re-check credential ACTIVE state during code replacement; it could regenerate codes after concurrent disable. Added `SELECT ... FOR UPDATE` ACTIVE state validation in the replacement transaction.
4. Added DB regression assertion that an accepted TOTP timestep cannot be reset to NULL.

## Verification executed (this host)
- PASS: `node scripts/typescript-syntax-check.mjs` — 126 source files.
- PASS: `node scripts/repository-security-check.mjs` — 325 text files.
- PASS: `node scripts/architecture-check.mjs`.
- PASS: `node scripts/financial-invariant-check.mjs`.
- PASS: `node scripts/services-events-invariant-check.mjs`.
- PASS: `node scripts/product-operations-invariant-check.mjs`.
- PASS: `node scripts/production-hardening-invariant-check.mjs`.
- PASS: `node scripts/git-history-secret-check.mjs` — 278 reachable tracked paths.
- PASS: `git diff --check`.
- BLOCKED: `cd packages/security && npm run test` failed TypeScript compilation because `@types/node` is not available in the installed dependency graph (`node:crypto` and `Buffer` unavailable). This is NOT a test pass or an application defect proof.
- BLOCKED: PostgreSQL 18 migration/atomicity tests (no available database). DB regression assertion authored but not executed.
- BLOCKED: NestJS API/session integration, genuine full dependency-backed typecheck/build, browser E2E, concurrent MFA replay, staging.

## Open risks / limits
- Recovery factor validation and session rotation are separate transactions; a failed rotation may consume a factor. Evaluate failure recovery as part of Task 3; do not weaken factor replay prevention.
- A challenge/disable action can race with other session state transitions; real DB concurrency and session ownership tests remain required.
- Strict transaction-level guarantee for recovery-code regeneration versus disable now includes active-state row lock; requires real Postgres verification.
- No claim made that the actual live release flags were inspected; they must remain disabled.
- No independent subagent was invoked. Reviews were performed using direct source inspection and static analysis.

## Handoff
- **Task 2 status: SOURCE HARDENING COMPLETED; FULL VALIDATION BLOCKED**.
- No commit or release tag was created. Further Task 3 work must continue on the preserved WIP or the exact snapshot, not the pristine Batch 4 ZIP.
- Do not promote to production; do not activate `events.refunds` or `operations.organizer_payouts`.
