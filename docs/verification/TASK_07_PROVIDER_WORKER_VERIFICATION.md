# Task 7 — Provider/worker source audit and verification (2026-10-08)

## Custody
Starting HEAD `1a3e123f6363ffc80ad2e4560f57120fa9c2e0b2`, tag `batch-04-handoff`; the Task 6 archive checksum matched `8b6b6e610900fb87e0f033b4673ddb4b0d7357266cfbbdd302988d8e8cf737ed`. Tasks 1–6 WIP retained. No release commit or production tag.

## Provider capability inventory (source inspection, not sandbox qualification)
| Adapter | Implemented boundary | Verification still necessary |
|---|---|---|
| Paystack | Payment initiation/verification, virtual account, payout/bank and raw webhook signature | Test verified amount/currency, duplicate/replayed callback and sandbox funding/payout |
| Monnify | Collection, virtual account and payout adapter, signature/requery paths | Sandbox authorization, evidence, delayed/contradictory callbacks |
| Monnify Bills | Catalogue, validation, vend, requery | Product enablement, provider request reference and sandbox vend status |
| VTpass | Catalogue, validation, vend, requery, status normalization; persisted request reference in BillService | Sandbox ambiguity, status/amount evidence, same-provider requery |
| Mono | Identity verification provider abstraction | Consent, response minimization and paid provider errors |
| Termii | SMS notification submission | Retry policy, accepted-vs-delivered status, duplicate sending |
| Resend | Email notification submission with idempotency key | Retry, webhook receipts and malformed response handling |

All sandbox entries: **BLOCKED** (no live test credential access or full running stack). This inventory does not prove provider behavior. Official provider docs must be rechecked before live launch.

## Evidence-backed worker defect and narrow fix
`apps/worker/src/main.ts` previously ran a recovery sweep asynchronously while SIGTERM closed the Nest application context; the timer was cleared but an already-running sweep was not awaited. This risks abruptly closing the database connection during reconciliation/notification work. New `createRecoverySweep` serializes sweeps, prevents new work after stop and exposes a drain awaited on shutdown. Shutdown is idempotent. Existing BillService/NotificationService code is reused; no provider or financial state behavior changed.

## Executed checks
- `node --experimental-strip-types --test apps/worker/test/recovery-sweep.test.mjs` — PASS (2/2 pure lifecycle tests, Node 22.16.0; not a Redis test).
- `node scripts/typescript-syntax-check.mjs` — PASS (128 TS sources).
- `node scripts/repository-security-check.mjs` — PASS (332 text files before this report).
- `node scripts/architecture-check.mjs` — PASS.
- `node scripts/financial-invariant-check.mjs` — PASS.
- `node scripts/services-events-invariant-check.mjs` — PASS.
- `node scripts/product-operations-invariant-check.mjs` — PASS.
- `node scripts/production-hardening-invariant-check.mjs` — PASS.
- `node scripts/git-history-secret-check.mjs` — PASS (reachable history only).
- `git diff --check` — PASS.

## BLOCKED / unresolved
- Node 24 LTS, genuine pnpm install/lockfile, dependency-backed provider/unit builds — BLOCKED locally.
- Real Redis/BullMQ queue delivery/retry/restart/outage tests — BLOCKED; existing `redis-worker.integration.test.ts` remains **unexecuted**.
- Real PostgreSQL migration/finance/ledger concurrency, job-at-least-once effects — BLOCKED.
- Provider sandbox real response/webhook/signature/timeout evidence — BLOCKED.
- Staging, load tests, DAST, container and deployment qualifications — BLOCKED.
- Durable queue producers are not established by `apps/worker/src/main.ts`; periodic recovery sweep is a fallback, not evidence of fully qualified job enqueue/delivery. Queue job default retry/backoff and poison-job policy need end-to-end qualification.
- Notification provider `ACCEPTED` is not proof of user delivery. Retry and UNKNOWN semantics need full integration verification.
- Remaining Task 4 privileged route transactional checks and session/role-race risks are not closed by this worker change.

## Safety and release posture
Never release wallet holds or change terminal ledger status based on a timeout without exact same-provider evidence. No blind cross-provider retries. The current code's high-risk release flags must remain `events.refunds=false`, `operations.organizer_payouts=false`. This checkpoint is **source-level only** and **NOT PRODUCTION QUALIFIED**.
