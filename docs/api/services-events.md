# Services & Events API — Batch 3

All authenticated mutating browser calls remain subject to the Batch 1 session + CSRF boundary. Financial mutations also require user-scoped idempotency.

## Services

- `GET /v1/services/products?category=AIRTIME|DATA|ELECTRICITY|CABLE`
- `POST /v1/services/validations`
- `POST /v1/services/purchases` with `Idempotency-Key`
- `GET /v1/services/purchases/:reference`
- `POST /v1/services/catalog/sync/:provider/:category` — operations role only

A successful vend is only finalized when the provider result contains evidence compatible with the immutable TwiPay amount/currency instruction. An uncertain provider call returns/settles internally as `UNKNOWN`/HTTP 202 and is reconciled against the same provider.

## Events

Public discovery:

- `GET /v1/events`
- `GET /v1/events/:slug`

Authenticated organizer/customer actions:

- `POST /v1/events/organizers`
- `POST /v1/events`
- `POST /v1/events/:eventId/ticket-types`
- `POST /v1/events/:eventId/publish`
- `POST /v1/events/checkout` with `Idempotency-Key`
- `GET /v1/events/orders/:reference`
- `POST /v1/events/tickets/check-in`
- `GET /v1/events/organizers/:organizerId/settlement`

V1 checkout is wallet funded. External-card checkout is not silently emulated; future rails must feed the same event-order/ledger rules deliberately.

## Error/uncertain-state behavior

Provider timeout is not translated to a false `FAILED`. For a potentially submitted bill request, TwiPay keeps the hold and records an `UNKNOWN` state until same-provider reconciliation establishes a terminal outcome.
