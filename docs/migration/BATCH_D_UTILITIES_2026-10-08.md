# TwiPay Batch D — Airtime, Data, Electricity, TV/Cable (source-integration checkpoint)

**Baseline:** Existing consolidated provisional master at `89cb1faaa9e7f08961b09a1a8f0be1088d4d6aff` (Batch C4). This document records Batch D changes on that same Git history, not a replacement project.

**Status:** SOURCE-INTEGRATED / SANDBOX OFF / NOT PRODUCTION QUALIFIED.

## Source mapping and implementation

- Preserved the original ErhaPay assets, brand mark, dashboard route hierarchy, ErhaPay palette, BackButton, CustomButton and account-service typography. Original top-level service route shells are saved byte-for-byte under `docs/migration/erhapay-legacy-service-shells/`. Old per-provider child components also remain for reference but are **not mounted** in the active route; they use incompatible BillPadi provider IDs and PIN calls. **The active generic purchase form is not guaranteed pixel-identical to ErhaPay.** Compare 8 responsive viewports against original screenshots and refine styling before visual sign-off.
- Four active routes `Airtime.tsx`, `Data.tsx`, `Electricity.tsx`, `TVCable.tsx` now render `IntegratedBillService` with exact server categories `AIRTIME | DATA | ELECTRICITY | CABLE` and actual provider-synced products. No invented network/disco/cable products, icons, fees or prices. Product catalogue `GET /v1/services/products?category=...` remains read-only and session-authenticated.
- Typed adapter in `apps/customer-ui/src/lib/api/dashboard-apis/bills.ts` and strict wire contracts in `billContracts.ts`: `POST /v1/services/validations`, `POST /v1/services/purchases` (Idempotency-Key + CSRF through established Axios layer), `GET /v1/services/purchases/:reference`. Records are owner-scoped by API. Price fixed/min/max and provider-safe `Number.MAX_SAFE_INTEGER` maximum checked using BigInt integer kobo, not Number/parseFloat. E.164 contact is optional. User must explicitly verify and review, then submit. Validation expires and is not reused across changed identifiers/products.
- Provider submission remains authoritative on API. The browser shows `UNKNOWN/PROCESSING/PROVIDER_SUBMITTED` as NOT PAID; `SUCCEEDED` only from server evidence. The API can return HTTP 202 with just reference/status/code; the adapter retains that reference without inventing a success. HTTP 409 with a *fully validated* FAILED purchase may be shown as failed; other HTTP 409 and network failures remain ambiguous. No automatic failover to another provider or automatic retries with new keys.
- Session storage holds only a logical bill idempotency key and reference, **not** card data, meter/smartcard identifiers or provider credentials. Network retries reuse the same key only with the current in-memory intent; after reload a pending attempt is blocked until history reviewed. An explicit confirmation is needed to abandon and start another intent. This is a safety aid, not a substitute for backend user-scoped idempotency.

## Independent default-off write protection

- Frontend flag: `VITE_TWIPAY_BILLS_SANDBOX_ENABLED=false`. Product previews may still load.
- Backend: `BILL_PURCHASES_SANDBOX_ENABLED=false` in the validated environment schema and `.env.example`. `POST /v1/services/validations` and `POST /v1/services/purchases` reject unless `NODE_ENV != production` **and** flag exactly `true`. Before either provider-affecting operation the backend additionally requires exact HTTPS sandbox hostnames `sandbox.vtpass.com` and `sandbox.monnify.com`; no custom paths, userinfo, query, port or protocol downgrade. UI switches cannot override API protection. Production validation and purchase endpoints stay blocked even if a flag is accidentally enabled.
- The existing `BillService` retains transactional holds, idempotency, provider-accepted reference written before submission, encrypted identifiers, provider-specific requery, reconciliation sweeps and provider evidence required to post the immutable ledger.

## Verification executed in this execution environment

- `node --experimental-strip-types --test docs/migration/test/*.test.mjs`: 80/80 isolated/source-contract tests (68 inherited + 12 Batch D) PASS.
- `NODE_PATH=/usr/local/slides_js/node_modules node scripts/typescript-syntax-check.mjs`: transpile syntax PASS.
- `node scripts/repository-security-check.mjs`, `architecture-check.mjs`, `financial-invariant-check.mjs`, `services-events-invariant-check.mjs`, `product-operations-invariant-check.mjs`, `production-hardening-invariant-check.mjs`: PASS.
- `node scripts/git-history-secret-check.mjs`: run after final commit. Git tree integrity and archive CRC: run during packaging.

## BLOCKED / unqualified — mandatory before sandbox writes or production

1. Node 24/pnpm pinned dependency install, real Vite+API build/typecheck and complete NestJS/worker tests (not available here).
2. Isolated PostgreSQL 18 + Redis 8, migrations, data fixtures, owner-scoped history/auth/CSRF/IDOR verification, real wallet holds, insufficient funds, simultaneous submissions, ledger consistency, provider uncertain outcomes and failed/reversed cases.
3. VTpass/Monnify sandbox product catalog synchronization; real validation and purchase requests, duplicate callbacks, provider requery, no-double-vend, credential/redaction/PII encryption, reconciliation, and explicit finance/audit approvals. Configure only sandbox credentials and URLs.
4. Client browser tests in `tests/e2e/customer-ui/bills-readonly.spec.ts` (prepared, not executed). Must evaluate route responsiveness at 1440x900,1100x800,1024x768,768x1024,390x844,360x780,844x390,780x360 and compare original ErhaPay visuals. Baseline screenshots missing.
5. Resolve developer's later Github/Prisma ADR 016–018 differences (not present in this checkpoint), review catalog/provider fees and proper per-category customer-identifier/provider validation, feature-flag governance, bank transfers and virtual account C4 concurrency, approved operational runbooks.
6. No real payments, live supplier calls or production purchases were performed by this implementation work.

## Product scope

Betting **permanently excluded**. e-PIN, international airtime/data, eSIM/mobile money, virtual cards, travel and referral/affiliate remain preserved in inactive source only, never presented as live payment services.

## Next

Continue Batch E events and customer operations in the same Git repository, **only after preserving this commit**. Bring in developer fixes later by a verified Git merge—not by reconstructing them or replacing this master.
