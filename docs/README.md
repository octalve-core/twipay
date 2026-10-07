# TwiPay Engineering Documentation

Documentation is a release artifact, not an afterthought. Each batch updates architecture, security, integration and runbook material in the same change as code/tests.

## Start here

1. `architecture/overview.md`
2. `security/security-model.md`
3. `adr/001-modular-monolith.md`
4. `architecture/financial-core.md`
5. `security/financial-security.md`
6. `architecture/services-events.md`
7. `batches/batch-03.md`
8. `legacy/erhapay-ui-inventory.md`

Development setup/debugging: `development/local-setup.md` and `development/debugging.md`.

## Batch 2 financial references

- API contract/behaviour: `api/financial-core.md`
- Architecture: `architecture/financial-core.md`
- Security controls: `security/financial-security.md`
- Provider notes: `integrations/paystack.md`, `integrations/monnify.md`, `integrations/mono.md`
- ADRs: `adr/006-double-entry-ledger.md`, `adr/007-idempotency-and-unknown-state.md`, `adr/008-provider-webhook-verification.md`, `adr/009-sensitive-identity-storage.md`
- Operational runbooks:
  - `runbooks/unknown-financial-transaction.md`
  - `runbooks/reconciliation-mismatch.md`
  - `runbooks/provider-webhook-failure.md`
  - `runbooks/virtual-account-credit-mismatch.md`
- Verification evidence: root `BATCH_02_VERIFICATION.md`

If code and documentation ever disagree, stop and resolve the discrepancy in the same change; do not silently choose one.

## Batch 3 services/events references

- Architecture: `architecture/services-events.md`
- API behavior: `api/services-events.md`
- Security: `security/services-events-security.md`
- Provider notes: `integrations/vtpass.md`, `integrations/monnify-bills.md`, `integrations/termii.md`, `integrations/resend.md`
- ADRs: `adr/010-service-provider-routing.md`, `adr/011-event-ledger-and-ticket-credentials.md`
- Runbooks: `runbooks/bill-purchase-unknown.md`, `runbooks/bill-provider-outage.md`, `runbooks/event-ticket-check-in.md`
- Verification evidence: root `BATCH_03_VERIFICATION.md`

## Batch 4 additions

- `architecture/product-operations.md`
- `security/product-operations-security.md`
- `api/product-operations.md`
- `adr/012-refunds-and-maker-checker.md`
- `adr/013-standalone-white-label-configuration.md`
- `runbooks/event-refund.md`
- `runbooks/organizer-payout.md`
- `runbooks/provider-routing-change.md`
- `batches/batch-04.md`

- Verification evidence: root `BATCH_04_VERIFICATION.md`
- Batch 5 continuation contract: `batches/batch-05-continuation-prompt.md`
