# Services & Events Architecture — Batch 3

## Scope

Batch 3 adds two revenue surfaces on top of the Batch 2 financial core:

1. normalized bill/service fulfilment for airtime, data, electricity and cable; and
2. wallet-funded event ticketing with organizer settlement liabilities and one-time check-in.

Neither domain owns money. Both use the existing `FinancialTransactionService`, wallet holds, immutable double-entry ledger, user-scoped idempotency and reconciliation rules.

## Service boundary

The core service domain speaks only `BillProviderPort`. Provider-specific request bodies, credentials, status codes and query rules live in adapters under `packages/providers/bills/*`.

Flow:

```text
canonical product -> active provider offers -> router -> selected provider
                                              |
                                              +-- BEFORE submission: alternate provider may be selected
                                              +-- AFTER possible submission: no blind failover
```

A purchase allocates the provider-side query/request reference before the network call and persists it with the purchase. This is required because an HTTP timeout can happen after the provider accepted the request. Reconciliation must therefore be able to query the exact original provider operation without recreating an identifier.

Provider outcomes are normalized to TwiPay states. A provider response is never allowed to create money or consume held money unless its evidence matches the immutable TwiPay instruction.

## Catalogue

`BillProduct` is canonical TwiPay product data. `BillProviderOffer` is a provider-specific offer for that product. A provider sync:

- creates or updates provider offers;
- normalizes prices/limits/categories;
- timestamps offers; and
- deactivates offers from that provider/category that disappear from a successful sync.

Cross-provider equivalence must be deliberately mapped; the system does not guess that two marketing names represent the same product.

## Routing

Routing inputs include active offer, explicit priority, cost evidence, recent health, latency and circuit state. Circuit breakers distinguish transient infrastructure/provider failures from deterministic customer/business failures.

Critical invariant: **failover is pre-submission only**. After a request may have reached a provider, the transaction becomes `PROCESSING`/`UNKNOWN` and is reconciled against that same provider. This prevents duplicate fulfilment.

## Events

Event organizers have an NGN, credit-normal, system-owned liability ledger account. V1 event checkout is wallet-funded and executes in one serializable database transaction:

1. lock requested ticket types in stable order;
2. verify published/on-sale status and capacity;
3. create an `EVENT_PURCHASE` financial instruction;
4. reserve user wallet funds;
5. create immutable order lines using authoritative ticket prices;
6. post the journal (customer wallet debit; organizer settlement credit; optional platform-fee revenue credit);
7. capture the hold;
8. settle the internal financial transaction;
9. mark order paid;
10. issue signed opaque ticket credentials; and
11. enqueue the receipt notification.

The platform fee is configuration-driven and defaults to zero. No commercial fee was invented in Batch 3.

## Ticket security

A QR payload is an opaque random ticket credential bound to a public ticket code and authenticated with HMAC-SHA256. Only the credential fingerprint and encrypted QR payload are stored. A ticket records the signing-key version so old tickets remain verifiable during planned key rotation.

Check-in requires organizer ownership in V1, locks the ticket row, cryptographically verifies the credential, requires the ticket to be active and creates a unique immutable check-in. Database triggers also mark the ticket checked in.

## Deliberately deferred

- event refunds (enum reserved but state transition blocked until a compensating ledger workflow exists);
- organizer bank payout/settlement execution;
- delegated event staff/check-in roles;
- free event tickets (price zero deliberately blocked in V1 accounting path);
- automated cross-provider canonical-product equivalence;
- advanced margin/revenue accounting for bill-service commissions.
