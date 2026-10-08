# TwiPay — Batch C1: Transaction history, detail and receipt integration

**Classification:** source-integrated with executable isolated contract tests; **NOT** dependency-backed build/browser/database/provider qualified.
**Codebase:** same continuous Octalve TwiPay master; customer UI is the preserved ErhaPay React/Vite UI. Old `apps/web` is not promoted as its visual replacement. No financial writes have been enabled.

## Contracts verified from actual repository

- `apps/api/src/modules/finance/presentation/finance.controller.ts` previously exposed session-guarded `GET /v1/transactions` (latest 100 only, `{transactions}`) and `GET /v1/transactions/:reference` (owner-scoped, `{transaction:object|null}`). The existing list/detail expose uppercase Prisma statuses/types, NGN integer-minor-unit amount/fee strings, dates and provider data.
- Original ErhaPay UI at `apps/customer-ui/src/routes/dashboard/History.tsx`, `TxnHistoryDetail.tsx`, desktop/mobile receipt and home history screens expected legacy `/transactions` envelope `{data,pagination}`, numeric naira amounts, and legacy metadata that TwiPay does not provide.
- Finance schema statuses: `CREATED`, `AUTHORIZED`, `FUNDS_RESERVED`, `PROVIDER_SUBMITTED`, `PROCESSING`, `UNKNOWN`, `SUCCEEDED`, `FAILED`, `REVERSED`, `CANCELLED`. No status is inferred to mean SUCCEEDED.

## Exact changes

1. **Read-only API extension** — preserved the historical `{transactions:[...]}` response and added `{pagination:{total,page,limit,totalPages,hasNext,hasPrev}}`; strict Zod query accepts page 1–10,000, limit 1–100, type and status enums, UTC date-only boundaries, nonnegative integer-kobo amount filters inside signed BIGINT range. `PENDING` aggregates pre-provider states and `IN_FLIGHT` aggregates provider-submitted/processing. Account ownership is exclusively `requirePrincipal(req).userId`, never a client-provided userId. Database `count`/`findMany` executed via a read-only Prisma transaction. Stable descending `(createdAt,id)` order. Detail adds stored `description` while retaining owner scope and masking bank accounts. No schema migration, money write, provider invocation or new secrets.
2. **Typed Vite customer adapter** — `txnHistoryApis.ts` now reads only `/v1/transactions` and `/v1/transactions/:reference` through existing cookie-session Axios client. Validates amount strings, references, NGN currency, backend status and response envelope, maps supported status/type labels, and formats money from `BigInt`/kobo without JS number conversion. Does not invent an old balanceBefore/After, unprovided service logo, unverified recipient or old provider reference.
3. **Retained ErhaPay screens** — history list, home history, detail, desktop/mobile receipt components retain existing markup/layout and styling. Add explicit read errors instead of blank/false-empty loading. Activate existing pagination on mobile; preserve filters and map them to the server; preserve original logo assets. The legacy "delete transaction" dropdown action has no backend equivalent and was removed (financial transaction records cannot be deleted).
4. **Receipt semantics** — successful transaction detail can use existing browser-side PDF download; non-SUCCEEDED states are explicitly labeled "Transaction record — not proof of successful payment" and cannot download a successful-payment receipt from the detail screen. The original receipt view shows the actual backend status and amount, and fee if present; no claim of bank statement, provider confirmation document, or cryptographically signed provider receipt. A future independently verified proof-of-payment endpoint can be added only when genuine evidence exists.
5. **Security** — narrowed read-only allowlist; server user-scoped history/detail; no newly authorized mutations; amount filters are integer kobo strings; no random/fake records or user-controlled owner ids. CSV cells beginning with spreadsheet formula prefixes are escaped, and double quotes are escaped. Betting is excluded from active filter options and transaction-specific screen branches; previously archived legacy source elsewhere remains inactive per project decision.

## Executed verification

- `node --experimental-strip-types --test docs/migration/test/*.test.mjs`: **38/38 PASS** (includes 11 new C1 isolated tests against actual client adapter and source contracts).
- `node scripts/typescript-syntax-check.mjs`: **PASS**, source parser (not full type-check).
- `node scripts/repository-security-check.mjs`: **PASS**, scanned source.
- `node scripts/architecture-check.mjs`: **PASS**.
- `node scripts/financial-invariant-check.mjs`: **PASS**.
- `node scripts/services-events-invariant-check.mjs`: **PASS**.
- `node scripts/product-operations-invariant-check.mjs`: **PASS**.
- `node scripts/production-hardening-invariant-check.mjs`: **PASS**.
- `node scripts/git-history-secret-check.mjs`: **PASS**, full reachable committed history scanned.
- `git diff --check`: **PASS** (for C1 changes). No unrelated formatting performed.

## Required gates before calling C1 runtime-complete

- **BLOCKED:** latest independent developer GitHub code and ADR 016–018 merge (unverified/unavailable here; do not copy blind), Node 24 pinned pnpm+actual lockfile and full `pnpm build`/typecheck, live PostgreSQL18/Redis8.
- **NOT EXECUTED:** `pnpm exec playwright test --config=playwright.customer-ui.config.ts tests/e2e/customer-ui/transactions-readonly.spec.ts` against isolated account, API-authenticated database requests and real records, original ErhaPay screenshot parity across viewports, auth/session expiry, row ownership negative test with two seeded users, pagination/filter correctness under real database.
- **NOT EXECUTED:** browser PDF receipt rendering with verified user-owned SUCCEEDED record. Browser-generated receipt is a representation of TwiPay's recorded transaction status, not third-party provider proof.
- **Known limitation:** offset pagination under concurrent inserts is not snapshot-stable across pages. Future cursor-based pagination can address this after actual DB qualification if required; no claim of a stable export of all history. Do not display unsupported backend filters or fake server finality.

## Continuous next work

Proceed to **Batch C2 — wallet funding/collections** only using the existing payment service/contracts with persistent logical-action idempotency, fees, provider submit/UNKNOWN requery and ledger verified evidence. Do not activate irreversible writes without real DB/provider sandbox qualification. Keep this same master and Git history; final single consolidated ZIP at project completion.
