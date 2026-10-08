# Provider sandbox qualification

Batch 5 does not treat adapter unit tests as proof that an external provider sandbox is available or behaves as expected. Production qualification requires sandbox/test credentials supplied only through the staging secret store and a recorded execution against the approved staging environment. No credential or raw sensitive provider payload belongs in Git or release evidence.

## Cross-provider rules that must remain true

For every money/service adapter, deterministic pre-submission failure may fail normally. Once a request may have reached a provider, timeout/ambiguous transport evidence is `UNKNOWN`; TwiPay must retain the original provider/reference and use same-provider requery/reconciliation. Do not fail over to another provider after uncertain submission. Financial mutation requires exact provider evidence, including amount/currency when applicable. Contradictory late evidence opens/retains reconciliation instead of rewriting terminal history.

## Required execution matrix

Record the provider's sandbox/test correlation/reference IDs, timestamps and redacted TwiPay internal references for each executed case. Never copy API keys, authorization headers, raw BVN/NIN, bank-account values, OTPs or webhook secrets into the report.

| Provider boundary | Success | Deterministic failure | timeout / 5xx / malformed | bad credential | webhook/callback invalid + duplicate + delayed | requery / UNKNOWN / reconciliation | operation-specific evidence |
|---|---|---|---|---|---|---|---|
| Paystack payments/funding | required | required | required | required | required | required | exact expected amount/currency before settlement; signature verification |
| Monnify payments/VA/payout | required | required | required | required | required | required | amount/currency verification; payout `UNKNOWN` retains reservation; no provider switch |
| Monnify Bills | required | required | required | required | callback/retry where supported | required | discovery -> validation -> vend -> same-provider requery; verified SKU mapping only |
| VTpass | required | required | required | required | callback duplicate/delay | required | `request_id` persisted before submission and exactly reused for requery |
| Mono KYC | required | required | required | required | N/A unless configured flow emits callback | provider-specific retry only where safe | local validation/throttle first; no unnecessary raw identity retention |
| Termii | required | required | required | required | provider delivery callback if configured | retry/idempotent notification delivery | no OTP/token leakage to logs |
| Resend | required | required | required | required | provider event if configured | retry/idempotent notification delivery | verified sender; no sensitive body/header logging |

## Provider outage and routing attacks

Also prove in staging/fault injection that an open circuit prevents new selection, an unavailable primary can fail over only before submission, an already-submitted `UNKNOWN` operation never switches provider, SKU remapping cannot use unverified equivalence, and duplicate provider callbacks produce at most one logical/financial effect.

## Evidence status

This document defines the release gate; it does not mark it passed. The gate is `PASS` only when the complete required matrix has been executed against provider sandboxes/test modes with approved credentials and the redacted evidence is linked from `BATCH_05_VERIFICATION.md`. Missing credentials, inaccessible provider sandboxes or unexecuted cases are `BLOCKED`, never `PASS`.
