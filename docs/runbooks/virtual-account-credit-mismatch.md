# Runbook — Virtual-account assignment/deposit mismatch

Use when a provider reports a virtual-account assignment or deposit that TwiPay cannot safely apply.

## Assignment mismatch
1. Locate the `VIRTUAL_ACCOUNT` provider operation by provider and HMAC correlation evidence.
2. Do not create an account manually from an unsigned/raw copied payload.
3. Compare provider terminal status with TwiPay operation status.
4. If provider reports success, verify account ID/number/name/bank/currency through trusted provider evidence.
5. V1 requires NGN and verified BVN eligibility; do not bypass those policies.
6. Resolve contradictory terminal evidence through the reconciliation workflow.

## Deposit mismatch
1. Confirm webhook signature verification passed.
2. Re-query the provider using `collectionReference`; a webhook alone cannot credit funds.
3. Confirm provider reports success and amount/currency match webhook/TwiPay policy.
4. Map the receiving account by provider account reference or TwiPay HMAC account-number fingerprint.
5. If no account maps, keep funds uncredited and investigate provider/account assignment evidence.
6. Check for an existing successful `COLLECTION` provider operation with the same provider reference.
7. Never create/manual-edit a wallet balance. Any approved correction must post through the ledger as a documented financial transaction.
