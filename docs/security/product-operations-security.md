# Batch 4 Product and Operations Security

## Preserved controls

Batch 4 must preserve Batch 1–3 controls: opaque HttpOnly sessions, CSRF, exact-origin controls, server-only secrets, encrypted sensitive fields, immutable/sealed journals, minor-unit money, user-scoped idempotency, provider isolation, exact monetary provider evidence and UNKNOWN/reconciliation behavior.

## Administrative authorization

Operations routes require both `SessionAuthGuard` and `PermissionGuard`. `SUPER_ADMIN` is a permission bypass role, but no privileged user assignment is seeded by migration.

High-risk approvals additionally require a **recent** MFA assurance. `MFA_STEP_UP_MAX_AGE_SECONDS` defaults to 600 seconds and is bounded to 60–3600 seconds. The refund and organizer-payout application services also receive/check that assurance signal so the rule is not represented only by UI visibility. Batch 4 does not claim the end-user MFA enrollment/challenge flow is production-complete; high-risk feature flags remain disabled until that flow and the finance operating model are verified in Batch 5. Enabling either `events.refunds` or `operations.organizer_payouts` also requires the caller to hold a recent MFA assurance at the server boundary.

## Maker/checker

The same user cannot prepare and approve an organizer payout or event refund. This is enforced in application code and PostgreSQL triggers.

## Audit

Operational audit rows are append-only. Provider controls, feature flags, brand/deployment changes, refund decisions and payout decisions create attributable audit evidence.

Audit records must not contain secrets, raw bank account numbers, BVN/NIN, session cookies or provider credentials.

## Customer ownership

Disputes can only reference the authenticated customer's financial transaction. Event refund requests can only target that user's own paid event order. Organizer payout requests can only target an organizer owned by the authenticated requester.

## Sensitive beneficiary data

Organizer payout beneficiaries reuse the encrypted Batch 2 beneficiary model. Operations queue responses expose only account name, bank code and last four digits—not ciphertext, deterministic fingerprints or plaintext bank-account values.

## Refund restrictions

Only full internal event-order refunds are implemented in Batch 4, and the public `events.refunds` feature flag is **seeded disabled**. A successful refund requires a new `REFUND` financial transaction and a posted compensating journal before the order can become `REFUNDED`.

A checked-in ticket blocks the refund.

## Organizer payout safety

Organizer payouts are disabled by default. Approval requires maker/checker, MFA, a ledger-derived settlement availability check under organizer lock, immutable payout instructions and provider verification.

Provider `SUCCEEDED`/`REVERSED` monetary outcomes require exact amount/currency evidence. Contradictory or incomplete evidence enters `UNKNOWN`/reconciliation and retains the reservation.

## Provider/SKU controls

Operations can enable/disable or reprioritize provider offers, but a provider offer cannot be silently moved to a different canonical product. Exact semantics and human verification evidence are required and persisted append-only.

## Frontend boundaries

Public URLs and API paths are assumed observable. Secrets are not hidden in frontend bundles. The web/admin API helpers use cookies/CSRF and do not store authentication tokens in browser local storage.

Brand colors are constrained to six-digit hex values before they are returned as configuration. Branding configuration is content/configuration, never executable code.

## Idempotency failure handling

Deterministic 4xx failures may be recorded/replayed for the same user-scoped idempotency key. A transient pre-commit failure releases a still-PROCESSING record with no resource so a temporary infrastructure/provider outage does not poison that idempotency key for its full TTL.

## Operations data minimization

Operations APIs do not return raw encrypted-at-rest fields merely because the caller is staff. Beneficiary responses are masked, compliance responses select only masked KYC metadata, and monetary `bigint` values are converted to decimal strings at the HTTP boundary.
