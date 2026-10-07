# Product Experience and Operations Architecture

## Purpose

Batch 4 turns the Batch 1–3 platform core into an operable TwiPay product without weakening the accounting, provider, identity or browser-security boundaries already established.

The customer and operations applications remain separate runtimes in the same monorepo:

- `apps/web`: customer wallet, services, events, tickets, organizer and support experience;
- `apps/admin`: restricted operations/finance/compliance console;
- `apps/api`: sole authoritative business/API boundary;
- `apps/worker`: background provider/reconciliation/notification execution.

Neither browser application is authoritative for ownership, permissions, money, provider status or ticket validity.

## Customer experience

The customer application uses only TwiPay APIs. Authenticated browser state is carried by the Batch 1 HttpOnly session cookie; the frontend does not persist session/JWT credentials in local storage.

Unsafe mutations rotate/retrieve a CSRF token and send `x-csrf-token`. Money/service actions additionally use a fresh idempotency key where required by the API.

The Batch 4 web surface includes:

- account/session profile;
- ledger-derived wallet summary and transaction history;
- collection initialization and virtual-account visibility;
- utility product catalogue, purchase submission and history;
- event marketplace and wallet checkout;
- event order/ticket history and full-refund request initiation;
- financial dispute submission;
- organizer creation, event creation, ticket types and publishing;
- event-specific check-in delegation;
- ticket check-in entry point;
- organizer settlement visibility.

## Operations experience

The operations application is permission-scoped. It is not an alternate customer API client with an `admin=true` flag.

The Batch 4 permissions include separate capabilities for dashboard, disputes, refund preparation, refund approval, payout preparation, payout approval, provider control, SKU mapping, reports, audit, feature flags and branding.

High-risk money approval uses all of:

1. authenticated staff session;
2. required permission;
3. recent MFA step-up (`MFA_STEP_UP_MAX_AGE_SECONDS`, default 600 seconds);
4. maker/checker separation;
5. database transition guard;
6. append-only audit record;
7. immutable financial transaction and sealed journal accounting.

## Refund architecture

Batch 4 implements only full refunds of internally wallet-funded event orders, with the public refund feature seeded disabled until the activation gate is verified. This is intentional.

The workflow is:

`customer request -> dispute/refund request -> maker review -> independent MFA checker -> REFUND financial transaction -> compensating reversal journal -> order/tickets refunded -> audit`

The original `EVENT_PURCHASE` journal remains immutable. Partial event refunds and provider-service refunds are not manufactured by application status changes.

Checked-in tickets cannot be refunded.

## Organizer payouts

An organizer payout is a reservation against the organizer settlement liability account, not an edit to a balance field.

The workflow is:

`organizer request -> bank-account verification -> reservation row -> finance maker -> independent MFA checker -> ORGANIZER_PAYOUT transaction -> same provider -> exact evidence -> ledger posting or UNKNOWN reconciliation`

`events.refunds` and `operations.organizer_payouts` are seeded **disabled**. Batch 4 contains the authorization enforcement but does not pretend that the production MFA enrollment/challenge journey is complete. Production operators must deliberately enable either only after live payout credentials, roles, operating controls and reconciliation have been verified.

A provider timeout never releases an organizer payout reservation automatically.

## Provider operations

Provider health/routing controls remain operational configuration over the Batch 3 router.

Cross-provider offer mapping is never inferred from similar names. Remapping an offer requires exact canonical semantics and an append-only `BillOfferEquivalenceVerification` record. PostgreSQL rejects direct remapping without that evidence.

## Reporting and commission evidence

The Batch 4 operations report summarizes users, financial transaction groups, event sales/platform fees, successful utility purchases and observed provider commission, plus outstanding operational queues.

Provider-reported commission is operational evidence. Settlement/reconciliation accounting remains authoritative; TwiPay does not book assumed provider income from a marketing rate.

## Feature and branding configuration

Feature flags are database configuration and changes are audited. Flags are disabled instead of deleted.

Brand configuration contains product/legal name, domain, support identity and constrained public colors. Public clients consume `/v1/product/config` and may style the product from that response.

## Sellability/licensing foundation

`DeploymentProfile` records local deployment identity:

- `TWIPAY_OWNED`;
- `WHITE_LABEL`;
- `ENTERPRISE_SOURCE`.

It also records licensee, status, allowed modules, support mode, optional reference and validity metadata.

This is intentionally **not remote phone-home DRM**. A licensed customer deployment remains standalone and does not require Octalve, OpenAI or another remote licensing service to keep running. Commercial enforcement/contracting can evolve independently of the application architecture.

## Event staff delegation

V1 delegation is deliberately narrow. An organizer owner may assign an existing active TwiPay user as `CHECK_IN` staff for one event. That assignment does not grant organizer ownership, settlement access, payout authority or general operations permissions.

The assignment itself is immutable except `ACTIVE -> REVOKED`, and deletion is rejected by PostgreSQL.
