# TwiPay Engineering Documentation

Documentation is a release artifact. Code, migrations, tests, ADRs, security controls, provider notes and operational runbooks must remain consistent in the same change.

## Start here

1. `architecture/overview.md`
2. `security/security-model.md`
3. `architecture/financial-core.md`
4. `security/financial-security.md`
5. `architecture/services-events.md`
6. `architecture/product-operations.md`
7. `api/mfa-and-sessions.md`
8. `deployment/environment-variables.md`
9. `release/security-gates.md`
10. latest `batches/batch-05.md` and root `BATCH_05_VERIFICATION.md` when present

Development setup/debugging: `development/local-setup.md` and `development/debugging.md`.

## Identity / financial references

- Auth/session/MFA: `api/mfa-and-sessions.md`, `security/security-model.md`, `adr/014-totp-mfa-and-session-rotation.md`, `runbooks/mfa-incident.md`
- Financial core: `api/financial-core.md`, `architecture/financial-core.md`, `security/financial-security.md`
- Providers: `integrations/paystack.md`, `integrations/monnify.md`, `integrations/mono.md`, `integrations/vtpass.md`, `integrations/monnify-bills.md`, `integrations/termii.md`, `integrations/resend.md`
- UNKNOWN/reconciliation runbooks: `runbooks/unknown-financial-transaction.md`, `runbooks/reconciliation-mismatch.md`, `runbooks/provider-webhook-failure.md`, `runbooks/bill-purchase-unknown.md`

## Events and operations

- Architecture/API/security: `architecture/services-events.md`, `architecture/product-operations.md`, `api/services-events.md`, `api/product-operations.md`, `security/services-events-security.md`, `security/product-operations-security.md`
- Refund/payout/routing: `runbooks/event-refund.md`, `runbooks/organizer-payout.md`, `runbooks/provider-routing-change.md`
- Standalone deployment/licensing: `adr/013-standalone-white-label-configuration.md`

## Batch 5 release engineering

- `adr/014-totp-mfa-and-session-rotation.md`
- `adr/015-release-qualification-and-fail-closed-flags.md`
- `deployment/staging.md`
- `deployment/production.md`
- `deployment/environment-variables.md`
- `deployment/backup-restore-rollback.md`
- `release/security-gates.md`
- `release/attack-regression.md`
- `release/provider-sandbox-qualification.md`
- `release/load-failure-testing.md`
- `batches/batch-05.md`
- initial managed services: `../infrastructure/managed-services/README.md`

If code and documentation disagree, stop and resolve the discrepancy in the same change. Never silently choose the interpretation that weakens a financial/security invariant.
