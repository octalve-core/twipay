# TwiPay — Batch E: Events, delivery notifications & customer operations
**Status:** SOURCE INTEGRATED — NOT RUNTIME/PRODUCTION QUALIFIED. 2026-10-08.

## Source/provenance
- Base: same provisional master `7db9174e0cbaf6528aa5fec0fb47f5540090fa93` (Batch D). No source from developer's inaccessible GitHub, ADRs 016–018 unmerged.
- Source of customer UX truth: ErhaPay-derived `apps/customer-ui`; original logo and binary artwork unmodified. No Next.js customer redesign. The original event step layout and styling have been preserved as much as verified API contracts allow; real side-by-side browser visual parity is still **BLOCKED**.
- All prior finance modules, Postgres migrations, Prisma models, session/RBAC/MFA, provider adapters and worker retained. No new payment backend project, no DB schema changes.

## Actual API contracts and frontend mappings
| Feature | Existing or added TwiPay API | ErhaPay-derived UI |
|---|---|---|
| Published events | Existing `GET /v1/events`, `GET /v1/events/:slug` | `EventsList`, `EventDetails` |
| Server price quote | **Added** guarded `POST /v1/events/quote` | `ConfirmEventsBooking` |
| Wallet-funded event checkout | Existing `POST /v1/events/checkout`; **enhanced** with mandatory `expectedTotalMinor`, independent sandbox flag | `ConfirmEventsBooking`, `Status`; PAID orders link to owner-scoped finance receipt |
| Retry/uncertain status | **Added** scoped `GET /v1/events/checkout-intents/:key` | `ConfirmEventsBooking` |
| Event order history / details | Existing owner-scoped `GET /v1/events/orders`, `GET /v1/events/orders/:reference` | Event list recent bookings, receipt/status |
| Delivery notification metadata | **Added** `GET /v1/notifications` (owner-scoped, no decrypted body/destination) | Notification list/details; no fake unread count |
| Transaction disputes | Existing owner-scoped `POST /v1/disputes`, `GET /v1/disputes` | ErhaPay Support layout adapted to financial reference, category, reason and details |

## Mandatory security invariants
1. Checkout **off by default on both sides**: `EVENT_CHECKOUT_SANDBOX_ENABLED=false` on API, `VITE_TWIPAY_EVENT_CHECKOUT_SANDBOX_ENABLED=false` in Vite customer UI. The API refuses checkout in production regardless of the feature flag. A frontend flag alone cannot permit any debit.
2. Server-only quote uses live DB ticket prices and platform-fee calculation. Actual checkout rechecks inventory, price and total within the serializable transaction; **mandatory** `expectedTotalMinor` must match before wallet reserve, ledger post or ticket issue. Quote is NOT a reservation. Total capped at PostgreSQL `bigint` maximum.
3. Wallet holds, immutable balanced postings, capacity locks, ticket credential signing/encryption, notification queue and user-scoped idempotency remain in the existing EventService. No fake local PIN or success state.
4. Client amounts are exact integer minor-unit strings (`BigInt` for calculation/formatting), never JS float for money. `PAID` is distinguished from unknown/pending/failed. Checkout QR credentials returned from backend are **intentionally stripped** by the customer data adapter and never persisted in sessionStorage or analytics.
5. Retry intent key persisted in sessionStorage *before* network submission, no recipient PII saved. `GET /checkout-intents/:key` checks the authenticated user + `event:checkout` scope, expiration and owner-scoped order to permit careful recovery. An unconfirmed/processing intent cannot be treated as failed or be silently resubmitted with a new key.
6. Notification API exposes only owner-scoped delivery metadata. Does **not** decrypt notification content, destination, or pretend to support read/unread / customer messaging. Dashboard bell badge showing fabricated unread counts was removed.
7. Customer dispute creation requires a financial reference already belonging to the user. This is **not** general email/WhatsApp support. Event refunds (`events.refunds=false`) and organizer payouts (`operations.organizer_payouts=false`) stay inactive pending maker-checker, MFA and qualification.
8. Betting remains out of TwiPay. Deferred ErhaPay modules remain inactive.

## Still incomplete / not approved to launch
- No real dependency-backed Vite/Next/Nest builds: this environment has Node 22 but the repo requests Node 24, and pnpm/registry lock/install are unavailable.
- No real Postgres18 + Redis8 integration or concurrency/oversell checks. Previous developer reported advisory-lock `$executeRaw` fixes (ADRs 016–018) but they remain **unmerged**. Specifically verify EventService `pg_advisory_xact_lock` against actual Prisma7 PostgreSQL driver before enabling checkout.
- No Playwright browser execution, screenshot baseline or pixel-perfect ErhaPay comparison. A read-only browser spec was added at `tests/e2e/customer-ui/events-readonly.spec.ts`; must execute it with disposable test accounts on all required viewports and capture browser/network anomalies.
- No event checkout financial sandbox test (wallet debits/holds/ticket QR sign-and-check-in/notification delivery) or double-spend/oversell race test. Checkout **must stay disabled**.
- The UI displays ticket public codes only, **not entrance QR credentials**. A secure authenticated QR display (e.g. auditable, anti-screenshot constraints as feasible, credential handling) is a separate required feature before admissions use.
- Public event images are not supplied by the existing backend; the UI uses generic visual glyphs, not fabricated photos. In-app notifications read/unread state and generic support request management require separate API/data models and authorization testing.
- Event organizer interfaces, event creation, ticket staff check-in and full refund UI are not part of this customer Batch E. Existing backend services remain; do not falsely advertise as integrated.
- Ticket checkout idempotency persistence, refund maker/checker, provider verification, customer notification delivery and end-to-end ticket ownership must pass real database/provider and browser tests before activation.

## Executed verification
- `node --experimental-strip-types --test docs/migration/test/*.test.mjs` — **97/97 PASS** on Node v22.16.0 (81 prior + 16 Batch E parser/security/source tests).
- `node scripts/typescript-syntax-check.mjs` — transpile-only syntax PASS; not full semantic compile.
- `node scripts/repository-security-check.mjs` — static scanner PASS.
- `node scripts/architecture-check.mjs`, `node scripts/financial-invariant-check.mjs`, `node scripts/services-events-invariant-check.mjs`, `node scripts/product-operations-invariant-check.mjs`, `node scripts/production-hardening-invariant-check.mjs` — static invariant checks PASS.
- Git secret/history scan and fsck: recorded in separate checkpoint verification output after commit.
- **NOT EXECUTED:** actual Vite/Nest compile, PostgreSQL and Redis runtime, authenticated user journeys, Playwright screenshots, provider sandbox and ticket issuance.

## Next milestone
Batch F: reconcile latest developer Git checkout/ADRs once available; real Node24 locked installation and complete TypeScript/Next/Nest/Vite builds; DB/Redis integration, real browser/visual parity, adverse-case security, ledger concurrency, wallet/provider sandbox transactions and operations release flags. Do not tag production until all mandatory gates pass.
