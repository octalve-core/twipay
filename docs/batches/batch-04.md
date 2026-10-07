# Batch 4 — Product Experience & Operations

## Objective
Turn the secure Batch 1–3 core into an operable customer/admin product while adding controlled refunds, disputes, organizer settlement payouts, provider operations, reports, feature/branding configuration and standalone licensing foundations.

## Customer product
- new Octalve-minimal authenticated TwiPay shell;
- dashboard, wallet/transactions, utilities, events, tickets, profile and support;
- runtime public brand configuration;
- organizer/event/ticket management and check-in workflow;
- event-specific check-in staff delegation;
- dispute and full event-refund request flows;
- no browser session token persistence.

## Operations product
- isolated staff console;
- permission-scoped dashboard, refunds, organizer payouts, provider health/routing, reports, feature/brand configuration and audit;
- no raw encrypted beneficiary fields returned by payout queues;
- maker/checker and time-bounded MFA step-up requirements for outgoing/refund money approvals;
- dedicated compliance view with masked KYC/dispute metadata only;
- customer organizer settlement payout request/history plus staff-side prepare/reject/checker/reconcile flow;
- circuit reset, routing priority/cost controls and evidence-backed SKU remapping in the operations UI.

## Accounting
- full event refund is a separate `REFUND` financial transaction plus compensating journal;
- organizer payout is a separate `ORGANIZER_PAYOUT` financial transaction and provider operation;
- ledger/journal immutability from Batch 2 is preserved;
- payout UNKNOWN retains reservation;
- provider success/reversal requires exact monetary evidence.

## Provider operations
- controls over offer active/priority/observed cost;
- health circuit reset is audited;
- cross-provider SKU remap requires exact semantic compatibility and append-only verification evidence.

## Commercial/configuration foundation
- public brand configuration;
- audited feature flags;
- local deployment profile for TwiPay-owned, white-label and enterprise-source editions;
- no remote phone-home runtime dependency.

## Database defense
Migration `0004_product_operations` introduces the operations models/permissions/configuration plus database guards for dispute ownership, refund accounting/state, event refund/ticket transitions, organizer payout ownership/maker-checker/state, append-only audit/equivalence evidence, verified provider-offer remapping, deployment profile persistence and narrow event-staff delegation.

## Deliberate boundaries
- both `events.refunds` and `operations.organizer_payouts` are disabled by default until a real MFA step-up flow, finance roles and live operating controls are verified;
- Batch 4 enforces recent-MFA authorization but does not pretend a production MFA enrollment/challenge flow is already complete;
- event refund is full-order/internal only;
- no generic provider-service refund is invented without provider-confirmed reversal evidence;
- partial event refund is not enabled;
- platform/provider commission remains evidence/reporting until reconciled accounting supports recognition policy;
- visual QR encoding may use a vetted frontend encoder later; the signed/encrypted ticket credential and check-in verification remain authoritative.

## Defects found while verifying Batch 4

- Batch 4 repository-wide strict checking exposed a Batch 3-origin non-exhaustive return path in `normalizeProviderBillStatus`; it now fails closed for an unsupported provider status.
- Operations DTO review found BigInt/ciphertext leakage risks in raw Prisma responses. Operations/refund/payout/provider/compliance responses now serialize monetary minor units explicitly and return only the minimum authorized fields.
- MFA assurance is now bounded by `MFA_STEP_UP_MAX_AGE_SECONDS` (default 600 seconds) instead of remaining trusted for the lifetime of a session.
- Transient pre-commit failures release PROCESSING idempotency records; deterministic client failures remain replayable.
