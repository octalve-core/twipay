# Runbook — Provider/reconciliation mismatch

Use when TwiPay and a provider disagree on amount, currency or terminal status.

1. Freeze automated repair for the affected transaction.
2. Preserve provider response/reference and TwiPay reference; do not log secrets/PII.
3. Inspect the reconciliation case evidence.
4. Re-query the provider from an authenticated server-side channel.
5. Verify settlement/bank statement evidence if necessary.
6. Inspect journal entries and reversals; never modify them.
7. If TwiPay accounting is correct, resolve the case with documented provider evidence.
8. If a financial correction is required, create an approved compensating journal/transaction through the operations workflow.
9. If multiple cases share a provider/time window, trigger a provider incident and consider routing/circuit-breaker action.
