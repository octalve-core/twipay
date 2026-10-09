# TwiPay Phase 5 / Batch 5.4 — Persistent inbox, preferences and restricted delivery oversight

**Date:** 2026-10-09 (Africa/Lagos)  
**Authority:** existing Git-backed TwiPay master (`2d7ffe12c6a4379e387354b31e296797e0e51f3d` at start), same `phase3/low-friction-contact-20261009` branch.  
**Status:** source implemented and dependency-light tests passed; **NOT** Node 24 / PostgreSQL 18 / Redis 8 / provider / browser / production qualified.

## Scope implemented

- Additive Prisma migration `0017_notification_inbox_preferences`: separate owner-scoped `notification_inbox_items` and `notification_preferences` tables, source notification unique reference, read timestamps, account FK and safe category/route DB checks. Adds `notifications.deliverySuppressed` (not a false provider failure or delivery success). Earlier migrations, money and provider tables remain unchanged.
- The authenticated customer API now exposes `GET /v1/notifications/inbox` (50-per-page, stable owner-scoped cursor, global unread count), `POST /v1/notifications/inbox/:itemId/read`, `POST /v1/notifications/inbox/read-all`, and strict `GET/PUT /v1/notifications/preferences`. Idempotent read operations only affect the signed-in account. `GET /v1/notifications` retains its existing delivery-history contract for compatibility, separately from the inbox.
- Safe allowlisted summaries are created **in the same database transaction as the encrypted outbox message** only for support replies, issued event tickets and selected security alerts. They never copy arbitrary `subject`, provider payload or encrypted message body into the inbox. Verification/PIN/password-reset/enrollment **challenge codes are explicitly excluded**. Security alerts and essential transactional ticket emails cannot be disabled via preferences. Historical delivery records are not blindly backfilled into the inbox, avoiding recovery-code exposure.
- User preferences apply to future support in-app updates, future event ticket in-app updates, and optional support reply emails (default enabled). When support email is disabled before dispatch, pending support delivery is suppressed and excluded from the retry worker; the in-app support conversation itself remains available. Delivery already handed to a provider cannot be retroactively recalled. Security warnings always remain enabled. We do **not** offer misleading toggle options for provider acceptance or compulsory transaction/security email.
- Original ErhaPay React/Vite notifications list/details and preferences foundation are connected to the new backend; read/unread indicators, read-one/read-all, explicit load-older, safe navigation targets, loading/errors and customer-friendly language are included. No replacement design system or changes to the original 123 assets.
- Operations UI has a separate `/notifications` delivery-health view, powered by `GET /v1/operations/notifications/delivery-summary`. RBAC `ops.notifications.read` plus recent MFA guard restrict access. Only aggregate status and suppression counts are returned — **no user IDs, destination addresses, provider secrets, subjects, message text or inbox contents**. No notification-admin mutation endpoint or financial operation is exposed.

## Test evidence

- Command: `node --experimental-strip-types --test docs/migration/test/*.test.mjs docs/design/test/*.test.mjs docs/integration/test/*.test.mjs docs/phase3/test/*.test.mjs docs/phase4/test/*.test.mjs docs/phase5/test/*.test.mjs docs/qualification/batch-f-ticket-security.test.mjs apps/admin/test/*.test.mjs scripts/test/stack-readiness.test.mjs`.
- **433/433 passed, 0 failed.** The 13 new service/source tests use a deterministic **in-memory Prisma/provider seam**; they do not establish real SQL transaction semantics. Existing foundation/support tests were updated only to reflect the new live notification contracts.
- Repository TypeScript **syntax** scanner, security/architecture, financial/product/services/production invariants and original ErhaPay design inventory passed. This is not a TypeScript semantic build or Vite rendering test.
- `scripts/qualification/phase1-3-preflight.mjs`: **PASS 5 / FAIL 0 / BLOCKED 9**. Node 24 unavailable (Node 22.16.0), genuine pnpm root lockfile absent, pnpm, PostgreSQL 18 and Redis 8 unavailable. No provider delivery was attempted.
- Reports: `docs/phase5/evidence/batch-54-offline-regression-2026-10-09.txt` and `docs/phase5/evidence/batch-54-runtime-preflight-2026-10-09.txt`.

## Mandatory follow-up / unresolved release gates

1. Node 24 frozen pnpm installation, Prisma 7 client regeneration, `0017` migration against disposable PostgreSQL 18 and independent migration verification.
2. PostgreSQL rollback, unique inbox item and same-transaction outbox creation, preference/read race and pagination contentions, server-authenticated HTTP and CSRF/permission/MFA negative tests.
3. Real React browser E2E (desktop/mobile accessibility, read/unread, pagination and preference save); actual notification worker/Redis and Resend sandbox delivery/suppression tests.
4. Operational review of provider outcome classification and retention policies. No legacy notification backfill or file attachments are automatically enabled.
5. Maintain default-off financial operations, event publishing, ticket checkout and admission until separately qualified. Phase 6 is mandatory release gating, not waived by 433 offline tests.

**Next:** Phase 5 complete enough for Phase 6 execution planning. Audit all unresolved Phase 1–5 runtime blockers before any live activation; Phase 6 must use Node 24/PostgreSQL 18/Redis 8, real browser/provider sandboxes, and separate release signoff.
