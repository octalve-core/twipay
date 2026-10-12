# TwiPay — Batch 6.3B Completion Audit & Phase 6.4 Execution Gate

Date: 2026-10-10. Authority: single Git master after `884f10fff05a0ad4957e6a6e748d66961dcb3994`. This is a **source-level** verification checkpoint only.

## No false certification

This review found the original 6.3B was a **secure partial implementation**, not the full seven-workstream scope. This follow-up delivers concrete additions (owner risk metrics, customer transaction/support references, OpenAPI contract documentation and provider control hardening) and a fail-closed live-admin qualification suite. It does **not** claim that all owner/staff lifecycle features exist, that the generated Swagger artifact has been examined in a running server, or that a browser journey has passed.

## Workstream status and source evidence

| Workstream | Now in source | Remaining unimplemented / unqualified |
| --- | --- | --- |
| 6.3B.0 — architecture / security baseline | Git checkpoint; operations module/role matrix; reviewed owner controller; explicit owner Swagger schemas and MFA/CSRF requirements; tests | Generate Swagger JSON on the actual Node24/Nest application and compare against live HTTP, check schema/permission drift |
| 6.3B.1 — owner/staff governance | Out-of-band owner bootstrap; two-owner prepare/approve/reject for SUPPORT_AGENT/AUDITOR/COMPLIANCE; session revocation; limited verified-account role management; staff and customer suspension through two-owner account access restriction; immutable SQL review evidence in migration 0019 | **NOT BUILT:** invitation/acceptance/revocation lifecycle for not-yet-registered staff; self-service first-owner provisioning (deliberately prohibited); formal last-owner succession/removal (no API can remove SUPER_ADMIN); dedicated employee consent; reactivation. Runtime migration/MFA/SQL concurrency not qualified |
| 6.3B.2 — executive overview | Owner role/MFA read-only dashboard; source-backed 30-day transaction counts/amounts; provider outcome state counts; provider circuit observations; support, financial exceptions, account groups; ticket/check-in counts; security-event summaries and pending owner reviews | Actual live metric accuracy/latency, real provider SLA and settlement-reconciled recognized revenue **not qualified** |
| 6.3B.3 — customer oversight | Owner-only exact email/UUID or bounded 40 recent accounts, masked email/KYC tier; 30-day aggregate activities; bounded 20 transaction UUID/status records, bounded 20 support references without message bodies; suspension review | Full investigative workflow, evidence custody and identity-document access intentionally deferred pending policy and privacy assessment |
| 6.3B.4 — financial/provider oversight | Owner links reuse existing refund/exception/payout/tier/provider queues. No owner money-moving endpoints. Provider mutation now requires *transaction-time* session/MFA/permission, lock and serializable isolation; sandbox opt-in disabled by default and always denied in production | Independent checker for all provider-routing changes and external provider sandbox qualification not implemented. Real financial APIs still disabled |
| 6.3B.5 — configuration/monitoring/audit | Existing audited product flag, branding, deployment, audit history; owner risk observations; MFA mandated for config writes; high-risk refund/payout flag activation prohibited in production | Separate two-person configuration review for nonfinancial settings, immutable audited alert delivery and external monitoring integration **not implemented** |
| 6.3B.6 — verification/packaging | New source/mocked tests and repository checks; original ErhaPay assets retained; new fail-closed manual browser qualification workflow | Node24, genuine frozen pnpm install, PostgreSQL18 migration 0019 and SQL deadlock tests, Redis8, generated OpenAPI JSON verification, real browser runs and live provider qualification remain **blocked** |

## Owner REST API / OpenAPI contract

Controller: `apps/api/src/modules/operations/presentation/operations.controller.ts`. Explicit Swagger schemas: `apps/api/src/modules/operations/presentation/owner-openapi.ts`. All routes below require an active opaque cookie session, `SUPER_ADMIN` role, `ops.owner.read` or specific owner permission, and recent MFA. Private identity data, account numbers and wallet balances are not returned by the new owner read surfaces. Passwords and MFA codes are never admin fields.

| Method/path, prefixed `/v1` | Response/use | Authorization |
| --- | --- | --- |
| GET `/operations/owner/overview` | observed customer/finance/support aggregates, 30-day window | owner read + MFA |
| GET `/operations/owner/risk` | 30-day provider status/circuits, security events, ticket counts, owner review counters | owner read + MFA |
| GET `/operations/owner/customers[?search=...]` | exact or bounded masked customer search | owner read + MFA |
| GET `/operations/owner/customers/:userId/activity` | bounded transaction UUIDs/status and case references, no message body | owner read + MFA |
| GET `/operations/owner/staff` | bounded staff roles, masked contact | owner read + MFA |
| GET `/operations/owner/staff/reviews` | bounded pending reviews | owner read + MFA |
| POST `/operations/owner/staff/reviews` | stage allowed role change; never applies role | owner prepare + MFA, sandbox only |
| POST `/operations/owner/staff/reviews/:reviewId/approve` | different owner applies reviewed change; invalidates target sessions | owner checker + MFA, sandbox only |
| POST `/operations/owner/staff/reviews/:reviewId/reject` | different owner rejects review | owner checker + MFA, sandbox only |
| GET `/operations/owner/customers/suspensions` | bounded pending access restriction reviews | owner read + MFA |
| POST `/operations/owner/customers/suspensions` | stage access suspension, no wallet changes | owner prepare + MFA, sandbox only |
| POST `/operations/owner/customers/suspensions/:reviewId/approve` | independent checker suspends active nonowner and revokes sessions | owner checker + MFA, sandbox only |
| POST `/operations/owner/customers/suspensions/:reviewId/reject` | independent checker rejects proposed suspension | owner checker + MFA, sandbox only |

POST operations additionally require `x-csrf-token` obtained from `/v1/auth/csrf` in the same session, strict Zod request validation, and transactional current-role reauthorization. Swagger annotates all these boundaries. The live OpenAPI build is **not** yet executable in this runner and must be generated/inspected before external API consumers rely on it.

## Configuration and provider safety change

`PROVIDER_OPERATIONS_SANDBOX_ENABLED=false` by default; provider offer/routing reset/catalogue equivalence operations are blocked in production even if `true`. In a qualified nonproduction sandbox, service methods revalidate `sessionId`, the required permission and recent MFA **inside Serializable transactions**, and lock the controlled provider row (plus the canonical product for equivalence) before mutation and audit. This protects against stale-role and stale-circuit edits but **does not** independently qualify financial provider calls or make transaction settlement assumptions. Brand/deployment/feature-flag mutation controllers now also require recent MFA. Production high-risk refund/payout activation remains denied.

## Phase 6.4 executable qualification contract (not yet executed)

Files: `playwright.admin-qualification.config.ts`, `tests/e2e/administrator/owner-governance.spec.ts`, `.github/workflows/phase6-4-owner-admin-qualification.yml`. The manual workflow requires explicit `DISPOSABLE-NO-LIVE-FUNDS` approval, protected `qualification` environment, two **different** email-verified owners with working TOTP, one disposable active verified staff target, and a running admin app and API with isolated DB. It refuses to run without a genuine checked-in `pnpm-lock.yaml` and frozen dependency install. It is not triggered by normal pushes, and never changes provider flags to enabled.

The browser qualification tests authenticate owner A/B, perform MFA step-up, review overview/risk and masked customer activity, make a controlled staff grant, reject a self-approval, independently approve with owner B, and check that the target's old session is revoked and fresh login receives only a limited role. It also checks unauthenticated/nonowner denial. The test **changes role state** only in the disposable fixture; do not run against production or customer data. Reset or destroy the disposable fixture afterward.

Missing exact prerequisites prevent meaningful completion here: Node 24, pnpm/registry, PostgreSQL 18, Redis 8, seeded qualified accounts and browser server. No test has been marked passed solely because a spec was written. Actual browser screenshots and HTTP traces should be attached to the signed release evidence.

## Risk register / release decision

- P0: No authentic pnpm lockfile or complete workspace build; no real runtime migrations or full semantic typecheck. **Blocked.**
- P0: No final independent financial/provider production enablement; no actual money-moving sandbox qualification. **Blocked.**
- P1: staff invitations for unregistered recipients and self-service owner succession intentionally absent; dedicated reviewer model needed. **Not implemented.**
- P1: independent approval of nonfinancial config changes not implemented; audited, MFA-gated writes still exist. **Partial.**
- P1: accurate provider monitoring requires production telemetrics; current database observations are not live SLA. **Partial.**
- P1: real browser admin accessibility/mobile parity, OpenAPI artifact generation and matching client tests. **Blocked.**

**Release = NO-GO.** The source can continue on this master. Do not interpret source tests as full execution certification. Preserve `OWNER_GOVERNANCE_SANDBOX_ENABLED=false` and `PROVIDER_OPERATIONS_SANDBOX_ENABLED=false` by default; never override the explicit financial/ticket/reconciliation release gates.
