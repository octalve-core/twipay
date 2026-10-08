# ADR 017 — Transactional Advisory Locking Execution via $executeRaw

**Status:** Accepted

## Context
High-concurrency money and inventory operations such as duplicate webhook reconciliation in `PaymentService` and limited-capacity event ticket checkouts in `EventService`—require PostgreSQL transaction-level advisory locks (`pg_advisory_xact_lock(hashtextextended(..., 0))`) to prevent race conditions (such as double credits or ticket overselling).

In PostgreSQL, `pg_advisory_xact_lock(...)` returns a `void` type. When invoked via Prisma's `$queryRaw`, Prisma attempts to deserialize each row and column into JavaScript types and throws an error (`Failed to deserialize column of type 'void'`).

## Decision
All transactional advisory lock statements in NestJS domain services (`PaymentService`, `EventService`) are executed exclusively via Prisma's `tx.$executeRaw` template tag:

```typescript
await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${item.ticketTypeId}, 0))`;
```

## Consequences
- PostgreSQL transaction-level mutual exclusion operates cleanly without query deserialization errors.
- Serialized execution for capacity-limited inventory and idempotent webhook ingestion is preserved across concurrent transactions.
