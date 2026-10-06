# Runbook — Bill Purchase UNKNOWN

1. Locate the TwiPay financial reference and associated `BillPurchase` + `ProviderOperation`.
2. Confirm the persisted `providerRequestReference` exists. Do not generate a replacement.
3. Confirm the customer's wallet hold remains reserved unless TwiPay already posted success/reversal.
4. Query the **same provider** using the stored provider request/reference.
5. Verify amount and currency evidence against the immutable financial instruction before applying a terminal result.
6. If evidence disagrees, leave the transaction unknown and move/open the reconciliation case as `NEEDS_REVIEW`.
7. Never route the same submitted purchase to another provider merely because the first provider timed out.
8. After the bounded automatic retry limit, investigate manually rather than looping indefinitely.
