# Runbook — UNKNOWN financial transaction

## Meaning
`UNKNOWN` means TwiPay cannot safely prove whether the provider performed the operation. It does **not** mean failed.

## Immediate rules
1. Do not manually mark success/failure based on a timeout alone.
2. Do not release an active payout hold while the upstream result is unknown.
3. Locate the TwiPay financial reference and provider operation/reference.
4. Query the provider using the server-side verification adapter.
5. Compare status, amount and currency with the TwiPay instruction.
6. Apply only a compatible verified outcome through the domain service.
7. If evidence conflicts, open/retain a reconciliation case and escalate to operations/finance.
8. Record any manual resolution and actor in the future admin/audit workflow; never edit journal entries.

## If provider says success
Settlement methods are idempotent. They post the expected journal once, capture the hold for payout, and transition status.

## If provider says failure
For payout, release the still-active hold and transition through the state machine. For funding, no wallet credit should exist.

## If provider says reversed
If a prior success journal exists, post a compensating reversal journal. Do not mutate the original journal.
