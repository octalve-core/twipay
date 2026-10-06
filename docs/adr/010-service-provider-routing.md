# ADR 010 — Provider-neutral service routing with no post-submission failover

- Status: Accepted
- Batch: 3

## Context

TwiPay must support multiple bill-service aggregators without coupling product logic to a provider. A timeout can occur after an upstream has already vended value, so blindly retrying another provider can double-fulfil while the customer is charged once.

## Decision

Use a provider-neutral `BillProviderPort`, normalized catalogue/offers, health/circuit state and router. Alternate routing is allowed only before submission. Allocate and persist a provider query/request reference before the first network call. After possible submission, preserve the selected provider and reconcile with that provider until the outcome is known.

## Consequences

- provider replacement does not rewrite the service domain;
- uncertain outcomes can take longer to resolve but do not create duplicate fulfilment;
- adapters must support a stable pre-submission request reference;
- provider-specific status codes stay inside adapters.
