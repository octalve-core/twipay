# Batch 4 Product and Operations API

All paths are under `/v1`. Error responses use TwiPay's structured error codes. Authentication/CSRF rules from `docs/api/authentication.md` continue to apply.

## Customer reads

- `GET /wallets`
- `GET /transactions`
- `GET /transactions/:reference`
- `GET /virtual-accounts`
- `GET /services/products`
- `GET /services/purchases`
- `GET /services/purchases/:reference`
- `GET /events`
- `GET /events/:slug`
- `GET /events/orders`
- `GET /events/orders/:reference`
- `GET /events/organizers/me`
- `GET /events/organizers/:organizerId/events`
- `GET /events/organizers/:organizerId/settlement`
- `GET /disputes`

## Customer mutations

- `PATCH /auth/me`
- `POST /disputes`
- `POST /events/orders/:reference/refund-requests` — idempotency key required
- `POST /events/organizers/:organizerId/payouts` — idempotency key required; feature disabled by default
- `GET /events/organizers/:organizerId/payouts`
- `POST /events/:eventId/staff`
- `GET /events/:eventId/staff`
- `DELETE /events/:eventId/staff/:assignmentId`

Existing financial/service/event mutation APIs remain documented in the earlier API files.

## Operations

`GET /operations/dashboard` requires `ops.dashboard.read`.

Refund workflow:

- `GET /operations/refunds`
- `POST /operations/refunds/:reference/prepare`
- `POST /operations/refunds/:reference/reject`
- `POST /operations/refunds/:reference/approve` — MFA + checker permission

Organizer payout workflow:

- `GET /operations/payouts`
- `POST /operations/payouts/:reference/prepare`
- `POST /operations/payouts/:reference/reject`
- `POST /operations/payouts/:reference/approve` — MFA + checker permission
- `POST /operations/payouts/:reference/reconcile`

Provider/catalog control:

- `GET /operations/providers`
- `PATCH /operations/providers/offers/:offerId`
- `POST /operations/providers/health/:healthId/reset`
- `POST /operations/catalog/offers/:offerId/verify-equivalence`

Read-only operations:

- `GET /operations/reports`
- `GET /operations/audit`

## Product configuration

Public:

- `GET /product/config`

Restricted:

- `GET /product/admin/flags`
- `PATCH /product/admin/flags`
- `PATCH /product/admin/brand`
- `GET /product/admin/deployment`
- `PATCH /product/admin/deployment`

Configuration writes require an attributable reason and are recorded in the operational audit trail.

## Batch 5 Task 4 authorization note

Organizer payout requests, event refund approvals and organizer payout approvals now have an additional **transaction-level** session/assurance check using the authenticated server-side session ID. Finance approvals also recheck their permission inside the transaction. This does not replace the HTTP authentication/permission/CSRF guards or the existing maker/checker and DB invariant checks. See `docs/verification/TASK_04_AUTHORIZATION.md` for the complete endpoint inventory, scope limitations and blocked PostgreSQL race tests.
