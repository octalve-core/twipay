# Financial Core API

All routes sit under `/v1`. Except signed provider webhooks, routes require the secure TwiPay browser session from Batch 1. Unsafe browser mutations also require exact allowed Origin + double-submit/session-bound CSRF verification.

## Money format
Money is sent as a positive decimal **minor-unit string**. Example: NGN 2,500.00 is `"250000"`. Responses serialize financial amounts as strings.

## Idempotency
Critical mutations require:

`Idempotency-Key: <16-128 character client-generated key>`

Keys are scoped to the authenticated user and operation. Different content with the same active key is rejected. Replay bodies are encrypted at rest.

## Endpoints

### `GET /wallets`
Returns the authenticated user's NGN wallet with posted balance, active holds and derived available balance.

### `POST /payments/collections`
Creates a provider-neutral wallet-funding attempt using `paystack` or `monnify`. The returned checkout URL is provider evidence only; a browser redirect never credits the wallet. Settlement requires server-side provider verification.

### `POST /transfers/resolve-account`
Server-side beneficiary name enquiry. Provider credentials never reach the browser. Response account number is masked.

### `POST /transfers`
Requires idempotency. Re-resolves the beneficiary, creates the financial transaction, locks/reserves wallet funds, submits payout, and applies only trustworthy provider outcomes. `UNKNOWN` keeps the hold active.

### `GET /virtual-accounts`
Returns only the authenticated user's assigned virtual accounts. Account numbers are decrypted only on the trusted server response path; storage remains encrypted.

### `POST /virtual-accounts`
Requires idempotency, explicit consent and a verified **BVN** in V1.

For `provider: "paystack"`, request also requires:
- `validationBankCode`
- `validationAccountNumber` (10-digit NUBAN)

TwiPay performs server-side name enquiry before Paystack assignment. Monnify uses the same TwiPay endpoint without provider-specific business logic leaking into the public domain model.

Paystack assignment may return `PENDING`; a later signed assignment webhook can activate it.

### `GET /transactions/:reference`
Ownership-scoped lookup (`reference + authenticated userId`) to prevent BOLA/IDOR. Beneficiary account data is masked.

### `POST /kyc/verifications`
Initiates BVN/NIN verification after local 11-digit validation, per-user throttling and explicit consent. Raw identifier is encrypted before storage.

### `POST /kyc/verifications/:id/continue`
Ownership-scoped continuation. Verified/failed/expired flows are not re-sent to the provider. OTP request/submission is permitted only in the correct verification states.

### `GET /kyc/verifications`
Returns safe metadata (status/type/provider/last four/timestamps), never raw BVN/NIN.

## Provider webhooks
- `POST /webhooks/paystack`
- `POST /webhooks/monnify`

These server-to-server routes bypass browser Origin/CSRF only because the adapters cryptographically authenticate the raw provider envelope. A failed local processing attempt remains in the durable inbox and may be retried only by a newly verified provider delivery. A signed success event does not itself move money; TwiPay performs server-side provider verification first.
