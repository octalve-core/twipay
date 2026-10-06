# Batch 3 — Services & Events

## Objective

Add the first service/event revenue surfaces without creating a second financial system. Batch 3 builds airtime/data/electricity/cable fulfilment and V1 events on top of the immutable Batch 2 ledger, wallet holds, idempotency and reconciliation architecture.

## Starting point

- Required base: Batch 2 handoff `ce9f5515f128922bcef8826a63a51a109aef642a` / tag `batch-02-handoff`.
- Batch 1/2 security and accounting controls are constraints and were not relaxed.
- Legacy ErhaPay/Data Arena code was not imported into the new TwiPay core.

## Implemented

### Bill/service domain

- normalized `BillProduct` + provider-specific `BillProviderOffer` model;
- product/customer-validation/purchase/query contracts;
- VTpass and Monnify Bills adapters;
- provider health + circuit-breaker routing foundation;
- stale offer deactivation on successful catalog sync;
- encrypted customer identifiers, provider validation references and fulfillment values;
- user-scoped idempotent purchases;
- wallet holds and existing financial state machine reuse;
- pre-submission persisted provider request references;
- bounded same-provider reconciliation with backoff;
- `UNKNOWN` handling for timeouts/ambiguous provider outcomes;
- exact amount/currency evidence requirement for terminal monetary provider outcomes;
- no post-submission blind failover.

### Events

- organizers and dedicated settlement-liability accounts;
- event publishing and ticket types/capacity;
- wallet-funded idempotent checkout;
- serializable checkout + stable ticket-type advisory locks;
- ledger-aware organizer/platform settlement;
- configurable event fee (default `0` BPS; no commercial fee invented);
- opaque random + HMAC authenticated QR ticket credentials;
- encrypted QR payload storage and signing-key versioning;
- one-time organizer-owner check-in in V1;
- customer order/ticket retrieval;
- event settlement balance query;
- receipt notification record creation in the same checkout transaction.

### Notifications / worker

- provider-neutral notification port;
- Termii SMS adapter;
- Resend email adapter;
- encrypted destination + body;
- bounded retry policy and delivery-attempt history;
- BullMQ worker handlers for bill reconciliation and notification delivery;
- periodic bounded recovery sweep so a lost queue notification does not permanently strand work;
- worker boots the same Nest application modules/services as the API instead of reimplementing financial/provider logic;
- worker now executes the same environment validation as the API before starting.

### Database defense in depth

Migration `0003_services_events` adds relational/check constraints and triggers that, among other controls:

- require a stable provider request reference when a bill purchase is created;
- bind bill purchases to the exact product/offer and `BILL_PAYMENT` instruction;
- make bill financial instruction/provider query reference immutable;
- reject deletion of bill purchase history;
- bind event orders to `EVENT_PURCHASE` instructions, including an exact immutable platform-fee match;
- permit internal event settlement only after a posted journal exists;
- prevent event order `PAID` before its financial transaction is `SUCCEEDED`;
- permit order lines only while the order is `CREATED` and require authoritative event/ticket-price matching;
- prevent order-line mutation/deletion;
- require ticket issuance from paid orders and cap issuance to purchased quantity;
- make ticket credentials/instructions immutable;
- enforce active-ticket-only immutable check-ins and mark the ticket checked in at the database layer;
- require organizer settlement accounts to be NGN, credit-normal, system-owned, unowned liability accounts;
- intentionally keep event refund transitions disabled until compensating accounting exists.

## Important Batch 2-origin defect found and repaired

Repository-wide Batch 3 syntax verification exposed malformed TypeScript already present in the Batch 2 handoff inside `finance/application/payment.service.ts`: an evidence object contained `verifiedCurrency ?? null` instead of a property assignment. Batch 3 repaired it to `verifiedCurrency: verified.currency ?? null` and retained the fix in the repository.

This was treated as a regression discovered by deeper verification, not hidden as an environment issue.

## Additional strict-TypeScript hygiene

Existing `process.env.KEY` access across server/worker TypeScript was mechanically converted to `process.env['KEY']` so it conforms to the repository's `noPropertyAccessFromIndexSignature` compiler policy. No secret values were introduced.

## Deliberately not implemented in Batch 3

- automatic cross-provider SKU equivalence. Different providers' marketing/product identifiers are not guessed to be equivalent; verified mapping belongs in operations tooling;
- event refunds/chargebacks;
- organizer payout to bank accounts;
- delegated event staff roles;
- free tickets;
- flights/hotels/cards/crypto/global rails;
- full customer/admin UI migration (Batch 4).

## Documentation added

- `architecture/services-events.md`
- `api/services-events.md`
- `security/services-events-security.md`
- ADR 010 provider routing
- ADR 011 event ledger/ticket credentials
- VTpass, Monnify Bills, Termii and Resend integration notes
- bill UNKNOWN/provider-outage and event check-in runbooks
- configuration entries for all Batch 3 environment variables

## Next batch

Batch 4 is Product Experience & Operations: complete TwiPay web/admin experience, operational controls, refunds/disputes/settlement workflows, provider monitoring, commissions/reports, feature flags and licensing/white-label configuration while preserving all Batch 1–3 invariants.
