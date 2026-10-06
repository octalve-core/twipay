# ADR 002 — PostgreSQL as Primary Transactional Store

**Status:** Accepted

TwiPay uses PostgreSQL for identity, wallet/ledger, transactions, events and operational state. Financial relationships require relational constraints and reliable transactions. JSONB remains available for bounded provider metadata, but raw provider payload dumps are not the core model.
