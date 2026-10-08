# TwiPay — Batch C wallet read-only integration (continuous master)

**Classification:** Source-integrated, regression tested; **NOT** yet runtime/browser qualified, **NOT** a live-payments release.

## User's operating decision

Continue development **independently of the other developer's ongoing backend work**, from the preserved ErhaPay/TwiPay master. Do **not** restart or build an unrelated backend, and do **not** wait for inaccessible GitHub to make safe, source-supported progress. At handoff, the developer should reconcile by comparing real Git commits and verifying tests, **not** overwrite master blindly or "start again".

## Proven API source contract

Inspected `apps/api/src/modules/finance/presentation/finance.controller.ts`:

- `GET /v1/wallets` is guarded by `SessionAuthGuard` and returns `{wallet:{id,currency,status,postedBalanceMinor,activeHoldsMinor,availableBalanceMinor}}`.
- All monetary values are **integer minor-unit strings**, not numeric naira.
- `apps/api/src/modules/finance/application/wallet.service.ts` computes posted balance from ledger entries and active holds from unexpired wallet holds. The backend remains the source of truth.

## Actual changes

- `apps/customer-ui/src/lib/api/dashboard-apis/walletApis.ts`: `getWallet()` now uses the supported `/wallets` route and checks response shape/currency/minor-unit strings. Other legacy action methods remain blocked by the API route allowlist.
- `apps/customer-ui/src/lib/money.ts`: NGN display helper accepts integer strings, uses `BigInt`, and never uses JS `Number` for money. Invalid data fails loudly rather than silently becoming `₦0.00`.
- `apps/customer-ui/src/components/dashboard/main-page/BalanceCard.tsx`: same original ErhaPay card/spacing/colours, existing balance-hiding behaviour, now displays API-verified `availableBalanceMinor` precisely and uses proper hide/show button accessibility text. API errors show an unavailable state, not fabricated zero balance.
- Other active and preserved read-only balance labels use the same formatter/query key. This does not activate their original funding/withdrawal/international/betting operations.
- `apps/customer-ui/src/lib/api/axios.ts`: narrowly allowlist read-only `/wallets`; all legacy funding, transfer and provider URLs still fail closed.

## Explicitly NOT completed

- Mutating money operations: funding/collections, bank-transfer recipient validation, transfer authorization, virtual-account creation, persistent per-action idempotency, provider UNKNOWN requery, receipts.
- Transaction history read/list/detail integration. The old ErhaPay history pages expect fields/metadata not provided by the currently inspected TwiPay API and cannot safely be mapped by inventing values.
- Real TypeScript dependency-backed frontend build, browser visual parity, Postgres-backed API runtime, payments sandbox and concurrency. **BLOCKED** pending supported Node24, approved pnpm and installed dependency graph, database/services environment.
- The other developer's ADRs 016–018 have not been inspected or merged. Do not claim otherwise.

## Checks performed

Run `node --experimental-strip-types --test docs/migration/test/*.test.mjs`: 27/27 source/isolated tests pass, including 5 Batch C tests. Repo syntax/security/architecture/ledger and Git-history secret scans pass. None substitute for executable end-to-end money-flow testing.

## Next safe work

1. Build typed customer transaction list/detail adapters against actual `GET /v1/transactions` and `GET /v1/transactions/:reference`, while respecting *no pagination/filter server support* and preserving ErhaPay visual hierarchy. Never invent old metadata, balanceBefore/After, or successful status.
2. Design funding and bank transfer flows with exact server validation and same-key retries, consumer-visible `PENDING`/`UNKNOWN` reconciliation. Add isolated tests and enforce server-supplied finality; no money-movement activation until full runtime qualification.
3. Continue subsequent batches for utilities/events and integrated browser/security test environment **in this one master repository**.
4. On eventual developer handoff, compare real Git history and migrations and integrate through reviewed Git commits; do not overwrite or restart.
