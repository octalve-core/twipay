# TwiPay Batch C4 — Virtual accounts / ErhaPay static-account integration

**Checkpoint:** source-integrated only; **NOT** production qualified. Build/browser/provider/DB tests not executed in this environment. Continue the same master repo and preserve original ErhaPay artwork/logo. No independent backend or app was created.

## What the actual repository supports

- `GET /v1/virtual-accounts` authenticates by the server session and returns only owner-scoped persisted accounts. Batch C4 extends the existing response with `provisioning` (up to 20 owner-scoped operation references/statuses) so a pending or UNKNOWN request is not displayed as an empty-success state after reload.
- `POST /v1/virtual-accounts` accepts a discriminated Paystack/Monnify payload: `consent: true` required; Paystack additionally requires `validationBankCode` and `validationAccountNumber` (10 digits). `Idempotency-Key` is required. The existing `VirtualAccountService` checks a **VERIFIED BVN** on the server. **NIN alone is insufficient.** It records provider operations, encrypts assigned account numbers, handles PENDING/UNKNOWN and listens for verified assignment/credit webhooks.
- New `GET /v1/virtual-accounts/validation-banks` is an authenticated Paystack validation-bank directory backed by the already existing `TransferService.listBanks`, only in authorized sandbox. The UI does not invent a bank list.
- The original ErhaPay `static-account` page and `AccountCardItem` remain. The older flow collected BVN, birth date and full name and called unrelated legacy endpoints. The active page now sends users to the existing TwiPay KYC settings route instead of re-requesting BVN and inventing an SMS OTP. The original owner/account/bank presentation and visual tokens are retained.
- Assigned accounts are displayed only from the authenticated API list and only marked usable when `status=ACTIVE`. PENDING/UNKNOWN/FAILED provider requests are labelled and can be refreshed; the browser cannot mark itself verified.

## Default-off gates / operational safety

- UI: `VITE_TWIPAY_VIRTUAL_ACCOUNT_SANDBOX_ENABLED=false` (default).
- API: `VIRTUAL_ACCOUNTS_SANDBOX_ENABLED=false` (default), and **always refuses create in `NODE_ENV=production`** even if configured true. Paystack requires a `sk_test_` key; Monnify requires exactly `https://sandbox.monnify.com` with no credentials/custom port. The sandbox bank directory uses the same independent API-side gate.
- Existing owner-scoped GET remains available when provisioning is off.
- Never put BVN/NIN, validation-account numbers, provider secrets, or OTP in local/session storage or a URL. Browser session storage holds only a transient provider choice, timestamp and logical idempotency key. Switching provider requires an explicit new intent; reset never cancels an existing provider operation.
- The server's signed/verified provider evidence and existing ledger posting paths remain authoritative. No frontend data can settle a deposit.

## Source verification

Run (Node.js 22 requires strip-types for an inherited `.ts` import in the C wallet test):

```sh
node --experimental-strip-types --test docs/migration/test/*.test.mjs
node scripts/typescript-syntax-check.mjs
node scripts/repository-security-check.mjs
node scripts/architecture-check.mjs
node scripts/financial-invariant-check.mjs
node scripts/services-events-invariant-check.mjs
node scripts/product-operations-invariant-check.mjs
node scripts/production-hardening-invariant-check.mjs
node scripts/git-history-secret-check.mjs
```

## Important unqualified gates (all BLOCKED / NOT EXECUTED; do not activate money movement)

1. Developer's actual latest GitHub branch/ADRs 016–018 remains unmerged; reconcile by Git comparison when available rather than guessing.
2. Frontend `pnpm install`, `tsc -b`, Vite build, Next builds and full backend Jest/Vitest suite: dependencies/Node24 unavailable here.
3. A live isolated PostgreSQL18/Redis8 run with Prisma7 adapter, migrations and real account test fixtures; account privacy/BOLA/CSRF and webhook evidence tests.
4. **Provider-operation concurrency:** the current virtual-account service performs a read of pending operations before creating an operation, without a demonstrated cross-request serialization boundary. Two distinct simultaneous idempotency keys for the same user/provider may race. Must be made atomic and tested against PostgreSQL before enabling sandbox provisioning at scale or production.
5. Paystack & Monnify sandbox virtual account creation, assignment, retry, webhook signature, duplicate delivery, UNKNOWN requery, account-credit idempotency and reversal behaviour.
6. Consent text/record provenance, verified BVN provider identity match and any KYC/provider onboarding requirements; ensure API does not permit unauthorized creation for another user.
7. Visual browser comparison across desktop/mobile, genuine MFA/session/CSRF flows and UI error states. Original ErhaPay logo must remain unchanged until requested.

Future features (eSIM, international, virtual cards, flight/hotel, referrals, e-PIN) remain preserved/inactive. Betting is permanently excluded.

## Next development

Continue **Batch D** only in this master once the current source checkpoint is preserved. Do not claim C4 production readiness. Prioritize closing concurrency and integration test gaps when proper infrastructure is available. All new utility provider writes must be independently gated and ledger-backed; preserve ErhaPay's existing service UI.
