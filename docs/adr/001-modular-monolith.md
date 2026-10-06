# ADR 001 — Modular Monolith First

**Status:** Accepted

## Decision
TwiPay starts as a modular monolith with separate web/admin/API/worker runtime processes rather than distributed microservices.

## Why
The first production scope needs strong transactional consistency and low operational cost. Premature microservices would add distributed transactions, ordering, network failure modes and deployment overhead without corresponding scale benefit.

## Consequence
Domain boundaries must remain explicit so a module can later be extracted without rewriting business rules.
