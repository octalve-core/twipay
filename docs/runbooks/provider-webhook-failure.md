# Runbook — Provider webhook failure

## Signature/authentication failure
1. Do **not** bypass signature verification.
2. Confirm correct provider/environment secret and raw-body capture.
3. Check whether a key/secret was rotated.
4. Compare current provider documentation.
5. Never paste the raw payload into a ticket/chat if it contains PII.

## Local processing failure after valid signature
1. Locate `webhook_events` by provider + deduplication/external reference.
2. A valid provider retry is cryptographically re-verified and may atomically reclaim a `FAILED` inbox row.
3. `PROCESSING` and `PROCESSED` duplicates must not execute concurrently/again.
4. If retries continue failing, inspect `failureCode` and linked provider/financial references.
5. Re-query the provider server-to-server; never edit wallet balances/journals.
6. For an `UNKNOWN` financial transaction, follow `unknown-financial-transaction.md`.
7. If amount/currency/status disagree, follow `reconciliation-mismatch.md`.

## Current limitation
Batch 2 persists the inbox before processing but executes the claimed handler synchronously. Before production scale, move the processing body to the dedicated worker/queue so webhook HTTP acknowledgement can be fast while preserving the same durable claim/deduplication semantics.
