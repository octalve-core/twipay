# ADR 006 — Double-entry ledger as financial source of truth

**Status:** Accepted

## Context
A mutable wallet balance cannot safely explain how money arrived, left, reversed or settled, and is vulnerable to concurrency/recovery errors.

## Decision
TwiPay uses immutable, sealed double-entry journals. Wallet balance is derived from the user's liability account. PostgreSQL independently enforces positive amounts, matching currency, sealing balance, immutability and no late entry append.

## Consequences
Financial changes require journals. Corrections require reversal/compensating journals. Queries may later use safe projections/materialized summaries for performance, but projections never replace the journal as source of truth.
