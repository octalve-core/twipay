# Batch 02 — Financial Core

**Status:** Implemented in source and reviewed. Dependency/database-backed verification is partially blocked in this execution environment; exact evidence is recorded in root `BATCH_02_VERIFICATION.md`.

## Objective
Build TwiPay's financial source of truth from first principles without copying the legacy ErhaPay API. Batch 2 must preserve Batch 1 identity/session/security controls while establishing accounting, money movement, payment-provider, virtual-account, webhook, KYC and reconciliation boundaries that later services/events can safely reuse.

## Delivered

### Ledger and wallet
- Provider-neutral double-entry ledger package using integer minor units.
- PostgreSQL ledger accounts, journals, journal entries and user wallets.
- User wallets are liability accounts; no mutable wallet-balance column exists.
- Journals are created open, receive entries, and can be sealed exactly once.
- PostgreSQL rejects unbalanced journals, cross-currency postings, post-seal appends, journal/entry mutation, duplicate reversals, illegal financial/transfer state transitions, wallet/account ownership mismatches and immutable instruction rewrites.
- Wallet balances are derived only from sealed ledger entries.
- Active holds reduce available balance without rewriting ledger history.
- Spend reservation locks the wallet row before checking available balance, preventing concurrent overspend.

### Transactions and idempotency
- TwiPay-owned financial transaction state machine with append-only state-change history.
- Explicit `UNKNOWN` state for untrustworthy provider/network outcomes.
- User-scoped idempotency `(userId, scope, key)` with canonical request hashing.
- Expired idempotency keys can be safely reused; concurrent reuse remains protected by the database uniqueness constraint.
- Idempotency replay bodies are AES-256-GCM encrypted at rest so checkout URLs, virtual-account details or future sensitive response values do not become plaintext duplicate stores.

### Funding and collections
- Provider-neutral funding orchestration.
- Paystack and Monnify collection adapters.
- A redirect or signed webhook alone cannot credit a wallet.
- TwiPay re-queries the provider server-to-server and requires successful status plus exact amount/currency agreement before ledger posting.
- Provider-confirmed funding reversal posts a compensating journal rather than modifying historical entries.

### Transfers and payouts
- Beneficiary name enquiry before payout submission.
- Beneficiary account numbers stored as AES-256-GCM ciphertext plus HMAC fingerprint and last-four display value.
- Funds are held atomically before external payout submission.
- Unknown payout outcomes retain the hold for reconciliation.
- Successful payouts post ledger entries and capture the hold.
- Verified failure releases the hold.
- Provider-confirmed reversal creates a compensating journal.
- Contradictory late terminal evidence opens reconciliation instead of rewriting a terminal TwiPay state.

### Virtual accounts
- Provider-neutral virtual-account orchestration for Paystack Dedicated Virtual Accounts and Monnify Reserved Accounts.
- V1 wallet-funding accounts require a verified BVN even if a provider also supports NIN.
- Paystack's Nigerian financial-services assignment path additionally validates the supplied bank account/bank code before requesting assignment.
- Paystack asynchronous assignment webhooks can complete a pending assignment.
- Terminal assignment contradictions, missing assignment fields, unmapped assignment events and non-NGN assignments become reconciliation evidence rather than guessed state.
- Assigned account numbers are encrypted at rest with deterministic HMAC fingerprints for secure matching.
- `GET /v1/virtual-accounts` returns only the authenticated user's accounts.
- Dedicated-NUBAN / reserved-account deposit webhooks are recognized but money is credited only after server-side collection verification and exact amount/currency validation.
- Provider deposit references are deduplicated under a transaction-scoped PostgreSQL advisory lock to close concurrent duplicate-credit races.

### Webhooks and reconciliation
- Raw-body HMAC verification for Paystack and Monnify.
- Durable webhook inbox with provider/event deduplication.
- Every repeated delivery is re-verified cryptographically.
- Previously failed processing can be atomically reclaimed on a valid provider retry; concurrent duplicate deliveries cannot both process.
- Reconciliation cases capture amount/currency disagreement, contradictory terminal status, unmapped virtual accounts, incomplete provider assignment evidence and duplicate settlement evidence.
- Batch 2 processes a claimed webhook synchronously after durable inbox persistence; moving the processing body to the worker/queue is a documented pre-launch hardening step.

### KYC
- Provider-neutral identity-verification port with Mono adapter.
- BVN/NIN local format validation before billable provider calls.
- Explicit consent recorded before provider invocation.
- AES-256-GCM identifier encryption, HMAC fingerprint, last-four display only.
- Verified/recent in-flight identity checks are reused locally before per-user provider-call throttling, preventing unnecessary billable requests.
- Verified identity short-circuits future continuation calls instead of invoking the provider again.
- Expired/failed KYC flows cannot be continued; OTP actions are valid only in permitted states.
- Provider/network ambiguity remains pending instead of blindly retrying a potentially billable operation.
- V1 funding-account eligibility uses verified BVN.

### Security and configuration hardening
- `DATA_ENCRYPTION_KEY` must decode from base64 to exactly 32 bytes at startup.
- Bank account numbers, BVN/NIN, OTP and similar sensitive fields are included in shared logging-redaction policy.
- Production Swagger UI is disabled by default; the OpenAPI contract remains generated by the application and can be explicitly enabled when intended.
- Provider credentials remain server-only and are optional until their adapter is activated.
- API responses default to `Cache-Control: no-store` for sensitive user-specific state.
- Shared/provider workspaces now resolve TypeScript source for typechecking but compiled `dist` JavaScript at runtime, eliminating development/production entry-point drift.

## Security properties preserved from Batch 1
- No authentication token storage in browser `localStorage`/`sessionStorage`.
- No provider secret in frontend/source.
- Unsafe browser mutations require exact allowed Origin + CSRF verification.
- Signed provider webhooks bypass browser CSRF only on exact webhook routes and must then pass provider cryptographic verification.
- Financial/KYC reads and mutations are scoped to the authenticated user.
- Provider SDK/adapters remain isolated behind provider-neutral ports/registries.

## Explicitly deferred
- Utility/bill vending and provider routing: Batch 3.
- Events and ticket settlement: Batch 3.
- Durable worker consumption of the webhook inbox and scheduled reconciliation sweeps: pre-launch hardening in Batch 3/5; the durable inbox/idempotent settlement boundary is already present.
- Automated provider transfer authorization flows for accounts configured to require OTP/manual approval. TwiPay preserves `REQUIRES_ACTION`/held funds safely; production provider accounts should either use an approved automated authorization configuration or this flow must be completed before that payout rail is enabled.
- Product-level fraud scoring, step-up limits and admin maker/checker resolution UI: Batch 4/5.
- Real sandbox/live provider certification and credentials: deployment stage only.
- Processor settlement fees: Batch 2 records gross principal clearing only. Verified provider fees/refunds must be posted as separate settlement/expense journals once settlement evidence is integrated; fees are never guessed.

## Verification
See root `BATCH_02_VERIFICATION.md`. No network/Docker/PostgreSQL/Prisma-dependent check is represented as passed when it could not be run.
