# Financial Security Controls

## Non-negotiable invariants
1. The sealed double-entry journal is the financial source of truth; no mutable wallet balance exists.
2. Journal amounts are positive integer minor units.
3. Every sealed journal has at least two entries and equal debits/credits.
4. Account currency must match journal currency.
5. Journals/entries are append-only after sealing; corrections are compensating/reversal journals.
6. One original journal can have at most one direct reversal.
7. Spend is serialized under a PostgreSQL wallet-row lock before a hold is created.
8. Critical authenticated mutations are idempotent per user/scope/key.
9. Provider timeout/transport ambiguity becomes `UNKNOWN`, not assumed failure.
10. Incoming money is credited only after server-to-server provider verification of status, amount and currency.
11. Contradictory terminal evidence is reconciled rather than overwritten.

## Sensitive data at rest
- BVN/NIN: AES-256-GCM ciphertext + HMAC fingerprint + last four only.
- Beneficiary account number: AES-256-GCM ciphertext + HMAC fingerprint + last four only.
- Virtual-account number: AES-256-GCM ciphertext + HMAC fingerprint + last four only.
- Idempotency replay response: AES-256-GCM ciphertext, preventing checkout URLs/account details from becoming plaintext duplicate stores.
- `DATA_ENCRYPTION_KEY` must be base64 and decode to exactly 32 bytes.
- `PII_FINGERPRINT_KEY` is a separate >=32-character HMAC key.

The encryption format is versioned (`v1...`) so future key/format rotation is possible without changing domain fields. Production key custody/rotation moves to managed secret storage/KMS before launch.

## Logging
Pino request serialization records only request method, URL and request ID. Shared redaction includes authorization/cookie/session material, passwords, tokens, BVN/NIN/identity identifiers, OTPs, bank account numbers, validation-account numbers, card numbers/CVV, API keys and secrets. Provider raw payloads containing PII are not persisted as generic debug logs.

## Webhooks
- Paystack and Monnify HMAC signatures use the raw request body and constant-time comparison.
- The browser security guard bypasses CSRF only for the exact provider webhook routes.
- Every retry is re-verified cryptographically.
- Inbox claim is atomic: `VERIFIED/FAILED -> PROCESSING` may be claimed once; `PROCESSING` duplicates do not race.
- A prior processing failure can be retried by a new valid provider delivery.
- Webhook status alone never credits the ledger.

## KYC cost/privacy controls
- Local BVN/NIN validation occurs before billable provider invocation.
- Consent is recorded.
- Per-user attempt throttling precedes provider calls.
- Already verified, failed or expired checks do not trigger unnecessary continuation calls.
- OTP actions are state constrained.
- Provider/network ambiguity stays pending to avoid blind billable retries.
- Provider raw identity response is reduced to minimal status evidence; TwiPay does not dump identity attributes into its database.
- Already verified or recently in-flight checks are reused before the provider-call rate limit is evaluated, avoiding unnecessary billable calls without weakening abuse controls.

## BOLA/IDOR
Financial reads use authenticated ownership conditions, not possession of a reference alone. KYC continuation requires verification ID + authenticated owner. Provider operations are internal and never authorized from caller-supplied user identifiers.

## Payout safety
- Beneficiary name is verified server-side before funds are held/submitted.
- Unknown outcome retains the hold.
- Provider amount/currency disagreement opens reconciliation.
- A contradictory late provider terminal status cannot silently rewrite TwiPay's terminal state.
- Provider configurations requiring manual/OTP transfer authorization remain safely non-terminal until a supported authorization path exists; do not enable those payout rails as fully automated production paths prematurely.

## Virtual-account safety
- V1 funding accounts require verified BVN.
- Paystack validation bank account input is resolved server-side first.
- Asynchronous assignment must map to an existing provider operation; terminal contradictions/missing fields create reconciliation.
- Deposits are mapped through provider account reference or HMAC account-number fingerprint.
- Concurrent duplicate provider credits are serialized with a PostgreSQL advisory transaction lock and provider-reference uniqueness.

## Browser/API exposure
Frontend users are allowed to see public endpoint paths and their own response data. Security never depends on hiding routes. Provider secrets, DB/Redis credentials, encryption/HMAC keys and server tokens never enter `NEXT_PUBLIC_*`, source code or browser JavaScript.

Production Swagger UI is disabled by default (`OPENAPI_DOCS_ENABLED=false`). OpenAPI remains an engineering contract and can be published intentionally later at the appropriate developer/docs boundary.

All API responses default to `Cache-Control: no-store` so browser/intermediary caches do not retain user-specific financial, KYC or session state.

## Remaining pre-production work
- Execute PostgreSQL migration/integration/concurrency tests in the target environment.
- Move inbox processing to durable worker queues with quick provider acknowledgement.
- Configure provider egress/source-IP requirements at deployment.
- Complete endpoint-specific fraud/risk limits and step-up rules.
- Integrate managed secret storage/KMS and key-rotation runbook.
- Run full ASVS/DAST/load/failure testing in Batch 5.
