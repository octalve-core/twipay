# ADR 011 — Event checkout uses the financial core and signed opaque tickets

- Status: Accepted
- Batch: 3

## Context

A separate event balance/payment implementation would duplicate financial invariants and make refunds/settlement unreliable. Sequential ticket IDs or unsigned QR payloads are forgeable.

## Decision

Wallet-funded event checkout uses Batch 2 holds and double-entry ledger in a serializable transaction. Organizer proceeds are represented by a system-owned NGN liability account. Ticket QR credentials use random opaque material authenticated by HMAC-SHA256 with a stored signing-key version; only encrypted QR data plus a fingerprint are persisted.

## Consequences

- event money remains auditable in the same ledger as all TwiPay money;
- platform fees can later be configured without redesigning accounting;
- signing keys can rotate while old tickets remain verifiable;
- refunds remain disabled until a compensating ledger workflow is implemented.
