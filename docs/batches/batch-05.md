# Batch 5 — Production Hardening, Qualification, Validation and Release

## Objective

Harden the Batch 1–4 TwiPay system for release without expanding the business scope or weakening the established financial/security architecture. Batch 5 completes real TOTP MFA/session security, adds release-grade test/security/deployment qualification, and classifies the artifact strictly from executed evidence.

## Security implementation

- standards-compatible TOTP enrollment and `otpauth://` provisioning;
- AES-256-GCM encrypted TOTP secret at rest;
- bounded clock skew and monotonically advancing accepted timestep for replay prevention;
- failed-attempt lockout and keyed-HMAC one-time recovery codes;
- auditable MFA disable/re-enrollment rather than credential deletion;
- opaque session rotation on MFA security transitions, with old token revocation and original absolute expiry retained;
- runtime absolute and idle session expiry with auditable reasons;
- PostgreSQL guards for session/MFA/recovery/security-event lifecycle integrity;
- customer and operations MFA enrollment/step-up/recovery/disable surfaces;
- recent MFA enforced on organizer payout request as well as high-risk finance/admin actions;
- nonce CSP, HSTS/headers and risk-specific API rate limiting;
- a server-side `HIGH_RISK_FEATURES_RELEASE_QUALIFIED=false` latch that prevents high-risk flag activation before production qualification.

## Qualification implementation

- PostgreSQL 18 migration/invariant and real concurrency test definitions;
- Redis/BullMQ retry/restart/deduplication integration test definition;
- Playwright browser attack/lifecycle/BOLA/MFA/CSP qualification;
- provider sandbox/failure/reconciliation execution matrix;
- repository and full reachable Git-history secret scanning;
- dependency audit, CodeQL, SBOM, filesystem/container vulnerability and staging ZAP workflows;
- lockfile-gated Node 24.21.0 Docker definitions for web/admin/API/worker;
- Cloudflare, Railway and managed-service deployment profiles;
- encrypted PostgreSQL backup/restore/integrity scripts and rollback policy;
- staging and k6 load/failure qualification definitions.

## Accounting/provider boundaries preserved

Batch 5 does not introduce a mutable wallet balance, financial floats, provider-specific business domain, cross-provider retry after uncertain submission or mutable journal history. Existing ledger, holds, idempotency, exact provider evidence, UNKNOWN/reconciliation, maker/checker, ticket credential and append-only audit rules remain authoritative.

## Release classification rule

`events.refunds` and `operations.organizer_payouts` remain false. A source-complete artifact is not production-qualified while mandatory dependency/PostgreSQL/Redis/provider/browser/staging/deployment gates are unexecuted or blocked. `BATCH_05_VERIFICATION.md` is the evidence record and determines whether the final tag may be production or release-candidate only.
