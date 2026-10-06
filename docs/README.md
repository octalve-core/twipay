# TwiPay Engineering Documentation

Documentation is a release artifact, not an afterthought. Each batch updates architecture, security, integration and runbook material in the same change as code/tests.

## Start here

1. `architecture/overview.md`
2. `security/security-model.md`
3. `adr/001-modular-monolith.md`
4. `architecture/financial-core.md`
5. `security/financial-security.md`
6. `batches/batch-02.md`
7. `legacy/erhapay-ui-inventory.md`

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
