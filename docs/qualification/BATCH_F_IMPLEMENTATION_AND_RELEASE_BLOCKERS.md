# TwiPay Batch F — security hardening and release-qualification evidence

**Date:** 2026-10-08. **Result:** NOT PRODUCTION QUALIFIED.

## Exact code provenance and constraints

- Starting repository HEAD: `5174c0ddd49acb670d47a75e2e8ad5803978ff26` (Batch E). Continue in this same Git history.
- GitHub developer checkout `octalve-core/twipay` is not accessible from this execution environment (DNS lookup failed); ADR 016–018 and developer's actual Node24/Prisma7 fixes have **NOT** been reviewed or merged.
- Source of truth for customer UI remains original ErhaPay-derived `apps/customer-ui`. No ErhaPay artwork, logo, CSS, or layout component was changed in Batch F.
- Betting permanently excluded; future modules remain inactive. All monetary mutations and ticket checkout remain default-off and require independent release qualification.

## Source-provenance defects identified and narrowed

1. **Ticket credential exposure in generic event-order detail and checkout response.** Before this batch, `EventService.getOrderForUser()` decrypted `credentialCiphertext` into `qrPayload` inside an ordinary order detail response. The checkout response also included the credential and persisted it in an encrypted idempotency response. This unnecessarily exposed a reusable bearer credential over unrelated API surfaces.
   - Generic order detail now returns ticket identifiers and statuses only, using restricted Prisma `select`.
   - New checkout responses and replayed legacy checkout responses expose only allowlisted ticket metadata; no ticket credentials are returned through checkout, list, or detail responses.
   - Added an owner- and paid-order-scoped credential retrieval method, verifying ticket `ACTIVE` status, signing-key version and HMAC fingerprint before returning the decrypted credential.
   - Sensitive retrieval has a separate authenticated `GET /v1/events/orders/:reference/tickets/:publicCode/credential` API and no-store/private/no-referrer response headers. A server-side flag `EVENT_TICKET_QR_SANDBOX_ENABLED=false` defaults OFF and production is explicitly refused. Successful reveal creates an audit event containing identifiers **not QR payload**; failure to audit fails the request.
   - **NOT QUALIFIED:** no trusted QR renderer has been integrated, no customer QR viewer enabled, no staff-scanner browser test, no real DB BOLA/integrity test. Do not market QR admission as operational.
   - **Legacy encrypted idempotency responses** may still contain QR credentials if event checkout was ever used on a database before this change; API replay is redacted, but privileged cleanup and re-encryption of prior records require live DB inventory, backup and owner approval before production.
2. **PostgreSQL `void` advisory lock result.** Existing `SELECT pg_advisory_xact_lock(...)` calls were executed via Prisma `$queryRaw` in event checkout and payment webhook code. PostgreSQL returns `void`; some Prisma/PostgreSQL driver paths cannot decode this as a row value. Changed exactly these two calls to parameterized `$executeRaw`; kept legitimate row-returning `SELECT ... FOR UPDATE` calls using `$queryRaw`. This matches the previously developer-reported intent, but **must still be verified under Prisma7 `@prisma/adapter-pg` against real PostgreSQL18**. No guess-based change to financial transaction semantics was made.

## Executed checks

Run `node scripts/qualification/batch-f-gates.mjs` and read `docs/qualification/BATCH_F_GATE_RESULTS.json` for status and evidence (machine-generated; rerunnable). The isolated tests include source contract checks, plus executable pure-response redaction cases. Source-level green does **not** mean dependency-backed TypeScript type-checking, live browser, provider, concurrency, settlement or release certification.

## Release gates that remain BLOCKED / unverified

1. **Verified developer code merge:** inspect latest Git remote HEAD and changes, ADR 016–018, Prisma adapter, updated dependencies and lockfile. Perform three-way Git reconciliation before deployment. **Never overwrite** newer corrections from the developer.
2. **Node24 + pinned pnpm + complete install/build:** current environment only has Node22, pnpm unavailable; `npm ci --offline` in `apps/customer-ui` failed `ENOTCACHED` for `zustand-5.0.3.tgz`; root `pnpm-lock.yaml` is absent. Do not invent lockfiles.
3. **PostgreSQL18 and Redis8:** Docker/psql/redis server not available locally. Run genuine migrations, ledger concurrency/holds, idempotency races, check-in double-spend/oversell, webhook requery, repeated virtual-account provisioning, receipts, MFA/CSRF/RBAC and worker jobs against disposable DB.
4. **Playwright real-browser visual regression:** original ErhaPay vs current TwiPay on eight requested viewports; customer/anonymous/admin personas, accessibility, network/console telemetry, error handling and screenshots. Current customer port and API port not reachable here.
5. **Real provider sandboxes:** Paystack and Monnify collection/transfer/VA, VTpass and Monnify Bills, callback signatures, no duplicate financial posting; *sandbox only*, never production keys in tests. All high-risk gates stay disabled.
6. **Secure ticket QR:** install/pin a trusted QR encoder with a real, generated dependency lockfile, create customer credential-view modal that only fetches upon deliberate reveal, no browser persistence/analytics, verify with multiple QR scanners, staff permissions, repeat check-in, cancellations/refunds, screenshots and rate limits. Current API access is deliberately sandbox-gated; **no customer-facing production QR display is claimed**.
7. **Operations controls:** maker/checker, fresh MFA step-up, environment flags, exact-origin, credentials redaction, restore/rollback, monitoring and production incident-response runbooks.

## Exact staging commands (on a disposable authorized machine)

```bash
# Start from the VERIFIED developer checkout, after three-way merge; run in repository root
node --version                     # Node 24 LTS required by root package.json
corepack enable
pnpm --version                     # use repository-pinned version
pnpm install --frozen-lockfile     # only after real pnpm-lock.yaml is obtained/generated from true dependency graph
pnpm build
pnpm test
pnpm test:repo
pnpm test:history-secrets
node scripts/qualification/batch-f-gates.mjs
# Start disposable local Postgres18, Redis8, API, worker, customer Vite app and admin
# Set APP_URL/ADMIN_URL/API URL and Playwright configuration to the actual live ports
pnpm e2e                         # read existing specs; sandbox/disposable accounts only
```

**Staging release authorization:** source checks PASS is insufficient. Any mandatory live browser, payment, DB concurrency, provider, financial-security or latest-backend merge gate BLOCKED means **RELEASE CANDIDATE ONLY**. Do not turn on payments/transfer/provisioning/bills/events, `events.refunds` or `operations.organizer_payouts` until all appropriate gates PASS.
