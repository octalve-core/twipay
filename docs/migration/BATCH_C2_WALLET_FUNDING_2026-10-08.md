# Batch C2 — TwiPay Wallet Funding / Collections

**Status: SOURCE-INTEGRATED, FAIL-CLOSED BY DEFAULT. Not qualified for production transactions.**
**Codebase:** one continuous TwiPay master. The customer UI remains the preserved ErhaPay React/Vite interface; the financial backend, accounting and worker are unchanged except for an opt-in sandbox safety gate on the collections controller.

## Source-level findings (confirmed)

- ErhaPay's original `EnterAmount -> SelectPaymentMethod -> MakePayment` flow expects `/wallet/providers`, `/wallet/fund` and a returned `paymentDetails.accountNumber`, `bankName`, `expiresAt`. These legacy endpoints/envelope do not match TwiPay and must NOT be called.
- TwiPay `POST /v1/payments/collections` accepts `{provider:'paystack'|'monnify', amountMinor:'positive integer string', currency:'NGN'}` and `Idempotency-Key` on the opaque-session + CSRF-protected route. It returns `transactionReference`, `provider`, `status`, optionally `amountMinor`, `currency` and `checkoutUrl`. It **does not** issue a bank account number for that collection request.
- Server `PaymentService.createCollection` already persists an idempotent financial transaction and provider operation; `verifyAndSettleCollection` does independent provider requery with exact amount/currency evidence, idempotent balanced journal entries, UNKNOWN handling and reversal ledger postings. Do not credit the wallet after browser callback or after initiating payment.
- Paystack and Monnify adapters return provider checkout URLs where available. Browser redirect is allowed only to HTTPS subdomains of the chosen provider (`paystack.com` or `monnify.com`). Absent/unknown URLs fail closed, never fabricate bank-transfer details.

## Implementation

1. Preserve the three original ErhaPay funding screens, typography and spacing; replace only the incompatible third screen's bank-account fields with transaction reference, amount, status and verified checkout link. The old logo/assets are retained.
2. Strict decimal NGN -> integer kobo conversion via `BigInt`; rejects non-decimal, fractions beyond two digits, zero, negatives and amounts beyond provider-safe `Number.MAX_SAFE_INTEGER` minor units. No floats for financial values.
3. Funding requests go through the existing TwiPay Axios opaque-cookie/CSRF client; extend its allowlist **only** for `/payments/collections`. Remove unused legacy `/wallet/fund` adapter. No direct provider credentials in customer UI.
4. Client generates one UUID-based `Idempotency-Key` per logical provider/amount intent, stores non-secret attempt metadata in `sessionStorage` so retries/reloads reuse the key. Mismatched provider/amount is blocked until user explicitly checks history and confirms starting a separate payment. Backend user-scoped 24-hour durable idempotency remains authoritative. A new attempt must never silently regenerate on an uncertain HTTP outcome.
5. The provider return route `/wallet/fund/complete` is a status-information page; it never treats query parameters, redirects or provider success messages as settlement evidence. Transaction status is read from owner-scoped `/v1/transactions/:reference` through the existing history UI.
6. **Default-off activation, independently enforced:** client `VITE_TWIPAY_FUNDING_SANDBOX_ENABLED=false`; backend `WALLET_COLLECTIONS_SANDBOX_ENABLED=false`. Even if toggled, backend refuses funding when `NODE_ENV=production`; Paystack requires `sk_test_` key, and Monnify requires exact sandbox host. Do not enable both until sandbox infrastructure and credentials are configured. No production collections can be activated by these flags; a future explicit release review must establish a production activation policy.
7. Both configured API `APP_URL` (exact customer-ui origin for CSRF/CORS) and provider callback route `/wallet/fund/complete` must point to the preserved ErhaPay-derived UI; never the deprecated simplified customer application. Provider onboarding and webhook endpoints need independent operational confirmation.

## Tests executed (source only)

- `node --experimental-strip-types --test docs/migration/test/*.test.mjs` — original 38 + nine C2 tests.
- `node scripts/typescript-syntax-check.mjs`, `repository-security-check.mjs`, `architecture-check.mjs`, `financial-invariant-check.mjs`, `services-events-invariant-check.mjs`, `product-operations-invariant-check.mjs`, `production-hardening-invariant-check.mjs` — rerun on this checkpoint.
- `git diff --check`, full reachable history security scan — run at commit.

## Mandatory blocked/nonexecuted gates

- **BLOCKED:** Node 24 + actual pnpm lockfile, `pnpm install --frozen-lockfile`, dependency-based `pnpm build` and complete TypeScript typecheck. The local container currently has Node 22 and no pnpm/dependencies for this React app.
- **BLOCKED:** real PostgreSQL18/Redis8, sandbox provider credentials and reachable running API/customer UI. Provider create -> webhook/requery -> exact credit -> double-event/idempotent credit -> reversal -> ledger balancing must be verified against real dependencies.
- **NOT EXECUTED:** Playwright `tests/e2e/customer-ui/funding-sandbox.spec.ts`. Requires explicit credentials and, for actual initiation, `TWIPAY_ALLOW_SANDBOX_COLLECTION_E2E=true` (non-production only).
- **BLOCKED:** developer's ADR016–018 changes from GitHub cannot be read/merged in this environment. This branch does not falsely claim those changes or full release qualification.

## Next

Continue Batch C3 (bank transfers), but retain `WALLET_COLLECTIONS_SANDBOX_ENABLED=false` until the runtime qualification gates above genuinely pass. Preserve ErhaPay's original UI and this same Git history; use one final consolidated delivery.
