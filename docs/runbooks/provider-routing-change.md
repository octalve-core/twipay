# Runbook — Provider Routing / SKU Mapping Change

## Routing control

Provider enable/disable, priority and observed cost may be adjusted only by an actor with `ops.providers.manage`. Record a meaningful reason. Check provider health and outstanding UNKNOWN transactions before disabling a rail.

## SKU equivalence

Never map provider products based only on similar marketing names.

Before remapping, verify exact TwiPay canonical semantics: category, currency, identifier type and amount constraints. Store evidence describing the source and verification. PostgreSQL rejects a direct productId remap without an append-only equivalence verification row.

Provider changes affect only future pre-submission routing; they do not move existing/UNKNOWN purchases to another provider.
