# Task 04 — RBAC/BOLA and financial authorization (2026-10-08)

Status: SOURCE-LEVEL PARTIAL HARDENING; DATABASE/RUNTIME VALIDATION BLOCKED.

Baseline: `1a3e123f6363ffc80ad2e4560f57120fa9c2e0b2` (Batch 4 tag), retaining all uncommitted Tasks 1–3 WIP.

## Confirmed gap and narrow change

`SessionAuthGuard` resolves the current session and permissions at request entry. Previously, organizer payout request and finance refund/payout approval passed this snapshot to financial application services without checking session state again inside the financial transaction. A revocation between guard execution and the transaction could therefore leave the old request authorized. The added `assertTransactionalAuthorization` locks the server-side session row with PostgreSQL `FOR SHARE`, checks user ownership, ACTIVE user/session, both expiries, and recent MFA from the session row. Finance approvals also check the permission from the current role assignments. Call sites pass the authenticated session ID, never a client-provided session ID.

The session-row lock prevents a concurrent session update/revocation committing *after* the transactional check but *before* the protected database commit. It does **not** guarantee that all role changes or user-status changes are serializable: those rows are not explicitly locked here. It also does not protect provider activity already dispatched before revocation. PostgreSQL concurrent integration tests are mandatory. If transaction lock ordering/deadlocks emerge in real tests, correct the lock order without removing authorization safeguards.

## Endpoint permissions (inspected operations/product controllers)

- Customer: `POST /disputes`, `GET /disputes`, `POST /events/orders/:reference/refund-requests`, `POST /events/organizers/:organizerId/payouts`, `GET /events/organizers/:organizerId/payouts`: authenticated session, service ownership checks; payout POST now additional in-transaction recent MFA/session check.
- `GET /operations/dashboard`, `/operations/payouts`, `/operations/providers`: `ops.dashboard.read`.
- `GET /operations/compliance`: `ops.compliance.read`.
- `GET /operations/refunds`, `/operations/disputes/:reference`: `ops.disputes.review`.
- `POST /operations/refunds/:reference/prepare`, `/reject`: `ops.refunds.prepare`.
- `POST /operations/refunds/:reference/approve`: `ops.refunds.approve`, recent MFA, checker separation, now in-transaction session/permission/MFA revalidation.
- `POST /operations/payouts/:reference/prepare`, `/reject`, `/reconcile`: `ops.payouts.prepare`.
- `POST /operations/payouts/:reference/approve`: `ops.payouts.approve`, recent MFA, checker separation, now in-transaction session/permission/MFA revalidation.
- `PATCH /operations/providers/offers/:offerId`, `POST /operations/providers/health/:healthId/reset`: `ops.providers.manage`.
- `POST /operations/catalog/offers/:offerId/verify-equivalence`: `ops.catalog.map`.
- `GET /operations/reports`: `ops.reports.read`; `GET /operations/audit`: `ops.audit.read`.
- `GET /product/config`: public.
- `GET/PATCH /product/admin/flags`: `ops.feature_flags.manage`; dangerous enabling additionally requires release latch and recent MFA in controller.
- `PATCH /product/admin/brand`, `GET/PATCH /product/admin/deployment`: `ops.branding.manage`.

`SUPER_ADMIN` bypasses permission matching, but does not bypass session or MFA checks. This is a *controller-level inventory*, not a claim that every route in the monorepo has been fuzzed or executed.

## Remaining security review/gates

- BLOCKED: PostgreSQL transaction tests for concurrent revocation versus payout/refund approval; role removal; user deactivation; transaction deadlocks; snapshot isolation.
- BLOCKED: real NestJS API tests and Playwright BOLA/CSRF/IDOR tests; genuine clean install and Node 24 toolchain.
- NOT YET IMPLEMENTED: in-transaction revalidation for all other privilege-sensitive mutation routes, including provider changes, SKU verification, feature flag enable, transfers, refund/payout maker transitions. Do not infer the new helper protects them.
- NOT PROVEN: application-level exact source of truth for production high-risk flags; deployment DB live values not inspected.
- WARNING: session revocation is not retroactive cancellation of financial provider requests already submitted.

High-risk flags remain `events.refunds=false`, `operations.organizer_payouts=false` until all mandatory release gates pass. No live secrets or production credentials were introduced.
