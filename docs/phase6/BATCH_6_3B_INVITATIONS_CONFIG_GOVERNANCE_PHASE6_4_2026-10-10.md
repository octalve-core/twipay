# TwiPay Batch 6.3B — Limited Staff Invitations, Configuration Governance, Phase 6.4 Gate

Date: 2026-10-10. Baseline Git HEAD: `78999f7dcb0dbd2179075dbd327b6fd74aad4bde`. Source-level checkpoint; **not production/release certified**.

## Reviewed scope and actual implementation

- **Staff invitations for people not registered yet.** Two existing SUPER_ADMIN accounts with active, recently MFA-verified sessions prepare and independently approve an invitation for a canonical email and one strictly allowlisted `SUPPORT_AGENT`, `AUDITOR`, or `COMPLIANCE` role. Preparation grants no permission. Approval queues a generic email via the established encrypted notification outbox; provider delivery is not presumed successful. Invitees sign up by the ordinary public signup flow, prove control of the matching email, enroll in MFA, and explicitly consent using the authenticated, CSRF-protected invitation endpoint. The acceptor's current role and session state are rechecked transactionally, an optional existing role conflict is rejected, and all existing sessions are revoked following a successful grant. An approved invitation can be revoked until accepted. Accepted invitations cannot be replayed.
- **Stored invitation evidence.** Encrypted email (AES-GCM via existing `DATA_ENCRYPTION_KEY`), keyed email fingerprint (`PII_FINGERPRINT_KEY`), masked email on the owner queue, immutable maker/target/role/reason evidence, independent checker ID, expiry, state constraints and a partial unique live-invite index. No raw invitation token, administrator-generated password or owner-privilege delegation is introduced.
- **Nonfinancial configuration governance.** Existing `/product/admin/flags`, `/product/admin/brand` and `/product/admin/deployment` PATCH write paths now refuse direct writes even with a privileged session. The new owner route stages strictly validated `BRAND`, `DEPLOYMENT`, or `FLAG_DISABLE` changes; owner A cannot approve their own proposal. Changes require recently MFA-confirmed sessions, an explicit sandbox-only opt-in, serializable transactions, review and business-row locks, a seven-day review expiry and a before-state fingerprint check. Only an existing feature flag's **disabled** state can be applied; feature enablement is not supported by the new path. Approval writes within the same transaction as review evidence and audit metadata.
- **Preserved restrictions.** No self-service SUPER_ADMIN, no provider routing activation, no financial eligibility override, no wallet/ledger mutations, no new real-money capabilities, and no public ticket/admission activation. Config and invitation writes remain **hard-blocked in production** even when their flags are set true. `OWNER_GOVERNANCE_SANDBOX_ENABLED=false` and `OWNER_CONFIGURATION_SANDBOX_ENABLED=false` remain the deployment defaults.
- **UI and OpenAPI.** The existing `/owner/staff` page supports invite preparation/approval/rejection/revocation, and the customer account settings screen supports authenticated consent. The admin `/config` page stages changes and displays pending owner reviews, not direct updates. `OperationsController` documents these paths with Swagger cookie auth, Zod-validated payloads, role/MFA, CSRF and UUID parameters, and kind-specific configuration schemas. The generated OpenAPI JSON is **not yet verified** from a running Nest application.
- **Database.** Additive migration `0020_owner_invitation_config_governance` adds `owner_staff_invitations` and `owner_config_reviews`, partial unique indices, evidence constraints and immutable-transition triggers. No financial table, existing migration or grant to an owner role is changed.

## API matrix (the global API prefix is `/v1`)

| Method | Route | Authorization / behavior |
|---|---|---|
| GET | `/operations/owner/staff/invitations` | Owner read with recent MFA; bounded, masked pending queue |
| POST | `/operations/owner/staff/invitations` | Owner maker + recent MFA + CSRF; create unapproved invitation |
| POST | `/operations/owner/staff/invitations/:invitationId/approve` | Different owner checker; queues generic email only |
| POST | `/operations/owner/staff/invitations/:invitationId/reject` | Owner checker with rejection evidence |
| POST | `/operations/owner/staff/invitations/:invitationId/revoke` | Owner restricted revocation of approved, unconsumed invitation |
| GET | `/operations/staff/invitations/mine` | Signed-in, email-verified customer; only own approved invitations |
| POST | `/operations/staff/invitations/:invitationId/accept` | Matching verified email, recent MFA, CSRF; transactional limited role grant and session revocation |
| GET | `/operations/owner/config/reviews` | Owner read with recent MFA, bounded queue |
| POST | `/operations/owner/config/reviews` | Owner maker; staged brand, deployment, or existing-flag disable only |
| POST | `/operations/owner/config/reviews/:reviewId/approve` | Independent checker; baseline drift and business-row lock before write |
| POST | `/operations/owner/config/reviews/:reviewId/reject` | Independent checker with recorded reason |
| PATCH | `/product/admin/{flags,brand,deployment}` | **Blocked**: old direct mutation route returns ServiceUnavailableException (once auth/MFA is satisfied) |

The authorization guard must never be treated as sufficient alone: transactional authorization, owner-role verification, review immutability, database constraints and session revocation are required. No API response includes encrypted email, raw identity documents or secret keys.

## Phase 6.4 actual evidence and deployment blockers

- Source syntax/scanners, full Git history security checks, ErhaPay inventory and dependency-light tests are executed. Count is recorded in `docs/phase6/evidence/batch-63bd-offline-regression-2026-10-10.txt`.
- `tests/e2e/administrator/owner-governance.spec.ts` (existing) and `tests/e2e/administrator/owner-invitations-configuration.spec.ts` (new) are **executable specifications**, not actual local passes. The second test requires TWO distinct seeded owners, a THIRD email-verified and MFA-enrolled disposable invitee with no AUDITOR role, and an isolated nonproduction HTTP server. It verifies checker separation, preconsent no-role, invitee MFA/consent, session invalidation and direct-product-write refusal. It does not prove the pre-registration/email-delivery leg of invitation onboarding; test that separately using an isolated SMTP inbox.
- `.github/workflows/phase6-4-owner-admin-qualification.yml` is manual (`workflow_dispatch`), requires `DISPOSABLE-NO-LIVE-FUNDS`, uses a protected `qualification` environment, a real `pnpm-lock.yaml` and frozen pnpm installation. New secrets `QUALIFICATION_INVITEE_EMAIL`, `QUALIFICATION_INVITEE_PASSWORD`, `QUALIFICATION_INVITEE_TOTP_SECRET` are required in that disposable environment. No production deployment or activation is performed.
- **Local environment observed:** Node 22.16.0; pnpm, genuine root lockfile, Docker, PostgreSQL 18 and Redis 8 unavailable. Runtime preflight: PASS 5, FAIL 0, BLOCKED 9. No Prisma 0020 migration, TypeScript semantic workspace build, Nest-generated Swagger artifact, browser admission/owner flows, concurrent SQL approvals or real notification dispatch has been executed here.

## Mandatory real qualification order

1. From this exact Git HEAD on trusted Node 24.21.0 + pnpm 12.9.1 with registry access, generate a genuine lockfile, review it and commit it. Install with `pnpm install --frozen-lockfile`, then generate the Prisma client.
2. Apply all additive migrations through `0020` to a fresh disposable PostgreSQL 18 database and validate constraints, triggers, unique indices and rollback behavior; run Redis 8 and background workers.
3. Build the API, customer-ui, admin and worker; run semantic typechecks, lint, and dependency-backed suites. Inspect built browser assets for betting, secret leaks and source parity.
4. Bootstrap **two** independent existing-owner accounts out-of-band, provision verified, MFA-enabled disposable staff accounts and disposable email delivery. Run the Phase 6.4 admin spec using the required isolated environment; include negative tests for self-approval, forged sessions, expired/stale proposals, simultaneous checker submissions, email mismatches and old session reuse.
5. Inspect the generated Nest OpenAPI schema and compare response bodies and permission denial statuses with actual HTTP traces. Run desktop/mobile browser accessibility checks and trace/error review.
6. Obtain an independent security and compliance signoff before proposing any broader environment switch. Keep all financial/settlement/event flags disabled until their separate acceptance gates pass.

## Source-level status

- Invitation and restricted configuration source implementation: **present and offline-tested**.
- Real migration, API authentication, email delivery, concurrency and browser E2E: **not certified**.
- Production access and financial releases: **NO-GO**.
- First-owner provisioning and succession: remain out-of-band (no self-service owner privilege escalation). Independent provider-routing and money-moving changes remain outside this nonfinancial configuration workflow.
