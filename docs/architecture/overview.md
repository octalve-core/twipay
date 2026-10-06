# Architecture Overview

TwiPay is a provider-independent modular monolith with independently deployable web, admin, API and worker processes. PostgreSQL is the transactional source of truth; Redis supports sessions/cache/queues; external providers are isolated behind adapters.

## Principles
- TwiPay owns identity, authorization, transactions, ledger, orders, routing, reconciliation, audit and UX.
- Providers are replaceable rails.
- One monorepo, separate runtime boundaries.
- Security is server-enforced; frontend secrecy is never relied upon.
- Financial core will use a double-entry ledger (Batch 2).
- All significant architectural decisions receive ADRs.
