# ADR 012 — Refunds and Outgoing Money Use Compensating Accounting + Maker/Checker

## Status
Accepted in Batch 4.

## Context
TwiPay needs customer refunds and organizer cash-out without weakening the sealed-journal financial core. Status-only refunds or single-admin payouts can create unauditable money movement.

## Decision
- Enable only deterministic full internal event refunds in Batch 4.
- Create a new `REFUND` financial transaction and compensating reversal journal; never edit the purchase journal.
- Block refund of checked-in tickets.
- Reserve organizer payout amounts against ledger-derived organizer settlement availability.
- Require different maker/checker users for refund/payout approval.
- Require a recent, time-bounded MFA step-up for high-risk checker approval.
- Retain reservations in `UNKNOWN` provider state.
- Require exact provider amount/currency evidence for terminal payout outcomes.
- Keep organizer bank payouts feature-disabled by default.

## Consequences
Provider-fulfilled utility refunds and partial event refunds require dedicated future workflows with equivalent accounting/provider evidence. Operations may not bypass these rules by changing statuses directly; database guards reject invalid transitions.
