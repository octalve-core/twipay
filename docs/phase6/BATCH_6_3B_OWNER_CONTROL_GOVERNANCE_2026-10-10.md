# TwiPay — Batch 6.3B Owner Control Centre and Platform Governance

Date: 2026-10-10. This is a source-level checkpoint, not a real-runtime or production release certification.

## Authority and invariants

- Started exclusively from Phase 6.3 `TWIPAY_PROVISIONAL_MASTER_CODE.zip`, Git `da9dc33f0e83886a6215750915322d91fbd75f44`; retain `apps/customer-ui` original ErhaPay design and all original media assets unchanged.
- Changes are **additive** to `apps/admin`, `apps/api`, Prisma schema and migration 0019. No ledger, provider, wallet hold, PIN, customer ticket or payment logic was modified.
- The API (not menu visibility) enforces authorization; controllers require owner-specific permission, explicit `SUPER_ADMIN` identity and recent MFA; all mutations additionally revalidate the active session and roles *inside a serializable transaction*.
- No owner/staff mutation runs in production, even if `OWNER_GOVERNANCE_SANDBOX_ENABLED=true`. The default `false` disables mutations in all other environments until explicitly qualified.
- No endpoint creates or promotes `SUPER_ADMIN`, assigns `FINANCE_OPERATOR`, `FINANCE_APPROVER` or `OPERATIONS`, modifies financial tier/limits, changes payment flags or directly touches ledger or customer balances.

## Delivered surfaces

1. `/owner`: backend-observed customer, financial activity, support and exception metrics with real time interval and explicit settlement caveat; links to existing operations queues, reports, audit and configuration.
2. `/owner/customers`: exact-email or UUID lookup and bounded recent directory. Masked email; no raw phone, BVN, NIN, identity photo, bank account or wallet amount. Independent customer suspension review can revoke customer access and sessions; restoration is **not available** here and requires a distinct compliance/identity incident-response process.
3. `/owner/staff`: approved staff/owner access snapshot, preparation and independent checking for limited role grants/revocations. Allowed roles: `SUPPORT_AGENT`, `AUDITOR`, `COMPLIANCE`. Existing users must be active and email-verified; there is no email invitation or self-registration as staff.
4. Operations: `/v1/operations/owner/...` endpoints backed by `OwnerGovernanceService`. All state changes go through owner-only protected write endpoints with CSRF defenses already present in the application.
5. A limited `SUPPORT_AGENT` role, scoped to support reading and replies; support-only logins route to `/support` and navigation is filtered by actual permissions.

## High-risk transaction policies

- Prepare/approve/reject happens as **two distinct, different owner users**, with recent MFA and per-action RBAC checks. Neither maker nor checker may be the target.
- A target with `SUPER_ADMIN` cannot be altered through these workflows. Prepared changes revalidate actor, role, target status, evidence and current assignment at approval. A seven-day limit applies to approvals; stale cases may still be rejected to free their unique pending-review slot.
- Staff changes revoke all active sessions for the target in the same transaction as the role assignment and immutable audit entry. The account must reauthenticate to receive new permissions.
- Customer suspension is a restricted review, **not** a wallet freeze, refund, hold release or KYC reinstatement. A successful suspension sets account `SUSPENDED` and revokes sessions without editing financial records.
- PostgreSQL review tables prevent fabricated terminal records without independent checker identities; prepared evidence and terminal history are immutable at the database trigger level. Only one prepared review per target/role (staff) or target (suspension) is permitted.
- Audit records do not contain passwords, MFA secrets, bank details or case message contents. Use neutral, non-sensitive review reasons; avoid entering raw BVN/NIN or customer medical/financial documents into evidence notes.

## Verification status

- `node --experimental-strip-types --test docs/phase6/test/phase6-3b-owner-governance.test.mjs` checks actual service methods against mocked Prisma/session seams, including disabled-prod mode, deny-role lists, owner identity, MFA, independent review, duplicate/stale changes, forced session revocation, row-locked sequencing, suspension and masked customer outputs.
- Run the combined dependency-light suite and every repository scanner; see recorded evidence in `docs/phase6/evidence/`.
- Real Node 24 workspace typecheck/build, genuine pnpm lockfile, Prisma migration 0019 execution, PostgreSQL 18 locks/deadlock checks, Redis 8, administrator browser E2E, external security review, provider sandboxes and financial runtime are **not qualified** in this environment. The Phase 6.3 connected-runner workflow remains authoritative for runtime evidence.

## Explicitly deferred (not silently implemented)

- Owner self-service onboarding / passwordless privileged invitations: bootstrap two separately approved owners through the out-of-band runbook, never through public/signup routes.
- Email invitations to people who do not have active email-verified customer accounts.
- Restoring suspended customer accounts, full customer risk investigation, privileged owner revocation, financial/operations/admin-grant approvals and emergency access under an independent incident response.
- Analytics revenue recognition, real-time provider KPIs and a mobile/desktop browser-verified admin redesign; current overview shows *observed* data only.
- Production activation of owner writes or money-moving features; both require separate documented policy, risk review, tests and explicit authorization.

## No-release decision

The source checkpoint may be used for continued development but is **not a production-approved fintech release**. Do not set financial or customer check-in flags live. Verify the new migration and all existing migrations on disposable PostgreSQL 18 with the genuine dependency graph before any deployment.
