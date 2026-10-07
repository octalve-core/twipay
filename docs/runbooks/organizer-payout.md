# Runbook — Organizer Payout

## Before enabling

- live payout provider credentials are configured only in the secure deployment environment;
- finance maker/checker roles are assigned to distinct people;
- real MFA enrollment/challenge and recent step-up are operating for approvers;
- reconciliation worker and provider status query are healthy;
- `operations.organizer_payouts` remains disabled until the above has been demonstrated.

## Processing

1. Organizer owner requests payout; beneficiary is verified server-to-server.
2. TwiPay checks ledger-derived settlement balance minus active payout reservations.
3. Finance maker prepares the request.
4. Different finance checker with a recent MFA step-up approves.
5. TwiPay creates the immutable `ORGANIZER_PAYOUT` transaction/provider operation before network submission.
6. Exact provider status/amount/currency evidence determines terminal accounting.
7. `UNKNOWN` retains reservation and must be reconciled against the same provider.

Do not submit a second provider payout because the first provider timed out.
