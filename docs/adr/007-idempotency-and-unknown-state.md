# ADR 007 — User-scoped idempotency and explicit UNKNOWN outcomes

**Status:** Accepted

## Context
Network retries can submit money operations more than once, while provider timeouts can occur after an upstream provider already accepted an instruction.

## Decision
Every critical authenticated mutation uses `(userId, scope, idempotencyKey)` plus a canonical request hash. An uncertain provider outcome becomes `UNKNOWN`; TwiPay does not release reserved funds merely because a request timed out.

## Consequences
Clients must generate stable retry keys. Operations/reconciliation must resolve UNKNOWN transactions. This intentionally favors accounting correctness over optimistic UX.
