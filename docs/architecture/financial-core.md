# Financial Core Architecture

## Purpose
Batch 2 establishes TwiPay's money-movement source of truth. Ledger, wallets, holds, transaction states, idempotency, provider operations, virtual accounts and reconciliation are TwiPay-owned concepts. Paystack, Monnify and future providers are replaceable rails.

## Ledger model
TwiPay uses double-entry bookkeeping. `journal_transactions` group immutable `journal_entries`. Every journal:

1. is created **OPEN** (`postedAt = NULL`),
2. receives at least two positive minor-unit entries in one currency,
3. is **SEALED** exactly once by setting `postedAt`, and
4. is immutable thereafter.

PostgreSQL independently rejects:
- committing an unsealed journal,
- sealing an unbalanced journal,
- account/journal currency mismatch,
- inserting into a sealed journal,
- updating/deleting entries,
- rewriting journal headers after creation,
- more than one reversal for an original journal,
- invalid wallet-hold amount/ownership/status mutation,
- rewriting immutable financial-transaction instructions or making illegal financial state transitions,
- binding a wallet to another user's/system/wrong-currency ledger account,
- rewriting provider-operation identity or replacing an already assigned provider reference, and
- rewriting a bank-transfer destination/narration or making an illegal transfer-state transition.

The application validates the same invariants before persistence. Database enforcement is defense in depth, not a replacement for domain validation.

## Wallets and balances
`wallets` deliberately has no balance column. The posted balance is derived from the wallet's credit-normal liability ledger account and only **sealed** journal entries. Available balance is:

`posted ledger balance - ACTIVE non-expired holds`

An expired hold is no longer counted as available-balance reservation and cannot be captured. Expiry is distinct from an explicit release; TwiPay does not falsify a release timestamp when a hold merely expires.

Spend reservation obtains `SELECT ... FOR UPDATE` on the user's wallet row before computing availability and inserting a hold. Competing spends against the same wallet therefore serialize around the availability decision.

## Money representation
Amounts are integer minor units (`BIGINT`). NGN 1.00 = `100`. API requests/responses serialize amounts as decimal strings so JavaScript number precision never becomes the financial source of truth.

## Accounting examples
Verified NGN 10,000 funding:
- Debit provider-clearing asset: 1,000,000 kobo.
- Credit user-wallet liability: 1,000,000 kobo.

Verified NGN 5,000 payout:
- Debit user-wallet liability: 500,000 kobo.
- Credit provider-clearing asset: 500,000 kobo.

A provider-confirmed reversal posts an opposite journal linked through `reversalOfId`; historical entries are never edited.

## Financial state machine
Typical path:

`CREATED -> AUTHORIZED -> FUNDS_RESERVED? -> PROVIDER_SUBMITTED -> PROCESSING/UNKNOWN/SUCCEEDED/FAILED -> REVERSED where permitted`

`UNKNOWN` means the provider outcome cannot yet be trusted. It is not an alias for failure. Unknown payouts retain their wallet hold until reconciliation establishes a safe terminal state.

## Idempotency
Critical authenticated mutations require a 16–128 character idempotency key and are scoped by `(userId, scope, key)`. TwiPay canonically hashes the request. A reused key with different content conflicts; a completed/failed request replays its prior response. Expired records may be recycled safely.

Replay response bodies are encrypted at rest. This prevents idempotency storage from becoming a plaintext copy of virtual-account numbers, checkout URLs or later sensitive response values.

## Provider operations
`provider_operations` separates TwiPay references from external references/statuses. Provider-specific data is evidence, not the system of record. Operations carry optional owning `userId`, merchant reference, provider reference, status and HMAC correlation data where needed for asynchronous assignment.

## Collections
A collection initiation creates a TwiPay financial transaction and provider operation. Neither frontend redirects nor webhook status alone can credit the wallet. Settlement re-queries the selected provider server-to-server and requires:
- `SUCCEEDED`,
- provider amount present and equal to TwiPay amount,
- provider currency present and equal to TwiPay currency.

Only then is the provider-clearing/user-wallet journal posted.

## Virtual-account provisioning
TwiPay creates a provider operation before calling the provider. V1 requires verified BVN for any wallet-funding virtual account. Paystack's Nigeria financial-services path additionally requires a server-validated bank account/bank code. Monnify remains behind the same provider port.

Paystack can complete assignment asynchronously. The signed assignment event is correlated through an HMAC of the customer's normalized email rather than storing plaintext email as a special webhook correlation field. Missing/contradictory/unsupported assignment evidence becomes a reconciliation case.

Assigned account numbers are stored as:
- AES-256-GCM ciphertext,
- deterministic HMAC-SHA256 fingerprint for matching,
- last four digits for safe display/index-independent support workflows.

## Virtual-account funding
A dedicated-NUBAN/reserved-account webhook is only a signal. TwiPay:

1. verifies the provider webhook signature,
2. normalizes the account/reference evidence,
3. re-queries the provider collection endpoint server-to-server,
4. requires successful status + exact amount/currency compatibility,
5. maps the deposit to an active TwiPay virtual account by provider account reference or HMAC account-number fingerprint,
6. obtains a transaction-scoped PostgreSQL advisory lock on the provider credit identity,
7. rejects/reconciles any conflicting duplicate provider operation,
8. creates the funding transaction/provider operation, and
9. posts provider-clearing debit + user-wallet credit exactly once.

V1 virtual-account funding is NGN-only.

## Payouts
Before payout submission TwiPay resolves the beneficiary account through the selected provider, encrypts the beneficiary account number, creates the transfer/financial transaction and atomically reserves funds. The raw account number crosses only the server-to-provider boundary at submission time.

A provider/network exception is `UNKNOWN`; the hold remains active. Server-side verification later applies only compatible evidence. `SUCCEEDED` or `REVERSED` payout evidence is accepted for ledger movement only when the provider supplies amount and currency and both exactly match TwiPay's immutable instruction. Contradictory terminal evidence opens reconciliation rather than rewriting a previously terminal TwiPay state.

Provider accounts configured to require payout OTP/manual authorization may return `REQUIRES_ACTION`; Batch 2 preserves the held transaction safely but does not implement an interactive authorization workflow. That rail cannot be declared fully automated in production until provider configuration/authorization is resolved.

## Webhook inbox
Every delivery is cryptographically verified using the current raw envelope. The inbox deduplication key protects duplicate provider events. `PROCESSED` events acknowledge idempotently. `PROCESSING` events cannot be concurrently claimed. `FAILED` events may be atomically reclaimed by a newly verified provider retry.

Batch 2 executes the claimed event synchronously after durable persistence. The next operational hardening step is to acknowledge quickly and move `processVerified` execution into the existing worker/queue while preserving the same claim/deduplication semantics.

## Reconciliation
Evidence disagreement is never permission to guess. Cases are created for amount/currency mismatch, terminal-state disagreement, unmapped provider accounts, missing provider fields and duplicate/ambiguous operations. Future admin/operations tooling resolves these through audited workflows and compensating entries where needed.

## Provider fees and settlement accounting
Batch 2 clearing journals deliberately represent **gross customer principal**, not final processor cash settlement. Provider fees are not guessed or inferred when a provider response does not provide trustworthy fee/refund evidence. Provider settlement/fee reconciliation must post separate verified fee/expense journals when the settlement evidence is available. A payout reversal therefore reverses only the principal journal; TwiPay must never assume an upstream fee was also refunded.

## Workspace runtime boundary
Shared/domain/provider packages expose TypeScript source for type resolution and compiled `dist` JavaScript for runtime imports. Root development builds dependency packages first. This prevents a compiled API from accidentally depending on raw workspace TypeScript in production.
