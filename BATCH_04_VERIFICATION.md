# TwiPay Batch 4 Verification Record

## Immutable reference

- Required Batch 3 base: `11b64d60d3fbf553e6e19cf440d8b0d549ea1aa2` (`batch-03-handoff`)
- Batch 4 implementation commit: `811349316de27056117fff2efce2b4a105b1c4a2`
- Final handoff tag: `batch-04-handoff` (resolve with `git rev-parse batch-04-handoff`)
- Scope: Product Experience & Operations
- The Batch 1–3 identity, provider, ledger, idempotency, UNKNOWN/reconciliation, ticket-security and server-only-secret boundaries remain authoritative.
- Legacy ErhaPay/Data Arena architecture was not copied into the TwiPay core.

This record distinguishes **executed verification** from checks blocked by the current execution environment. A blocked check is not a pass.

## Implementation covered

### Customer product experience

- Octalve-minimal TwiPay authenticated application shell and runtime brand configuration;
- dashboard, ledger-derived wallet/transaction history, utilities, events, tickets, profile and support surfaces;
- organizer creation, draft event creation, ticket types, publishing and event-specific `CHECK_IN` delegation;
- organizer settlement visibility plus payout request/history UI;
- customer dispute submission and feature-gated full event-refund request flow;
- cookie/CSRF browser boundary retained; no browser auth token storage.

### Operations / compliance experience

- separate permission-scoped operations application;
- dashboard, refund queue, organizer payout queue, provider health/routing, compliance, reports, configuration/licensing and audit surfaces;
- finance maker/checker separation for refunds and organizer payouts;
- prepare/reject/approve/reconcile payout controls;
- circuit-breaker reset, provider-offer activation, routing priority/observed-cost controls;
- evidence-backed cross-provider SKU remapping with server-side exact semantic validation;
- masked KYC/compliance views that do not select BVN/NIN ciphertext or raw provider result payloads;
- explicit HTTP DTO serialization for monetary `bigint` values and minimization of encrypted-at-rest fields.

### Refunds / disputes

- customer disputes are ownership-bound to the authenticated user's financial transaction;
- Batch 4 implements full wallet-funded event-order refunds only;
- a refund creates a separate `REFUND` financial transaction and compensating ledger journal;
- original purchase journals remain immutable/sealed;
- checked-in tickets block refund;
- maker and checker must be different users;
- public `events.refunds` flag is seeded **disabled** and enabling it requires a recent MFA assurance.

### Organizer settlement payouts

- organizer payout request verifies the bank beneficiary server-to-server and stores account data encrypted/fingerprinted/masked;
- payout availability is derived from organizer settlement ledger balance minus active payout reservations;
- payout preparation and approval are separate finance permissions/users;
- approval requires recent MFA assurance;
- payout instructions are immutable and provider success/reversal requires exact amount/currency evidence;
- ambiguous provider outcome remains `UNKNOWN`, retains the settlement reservation and creates reconciliation evidence;
- manual operations reconciliation requests are audit-recorded;
- `operations.organizer_payouts` is seeded **disabled** and enabling it requires recent MFA assurance.

### Provider operations

- provider health/circuit reset is audited;
- provider offer active/priority/observed-cost changes are audited;
- canonical SKU remapping is not inferred from names;
- mapping requires exact category/currency/customer-identifier/fixed-or-bounded amount semantics plus append-only human verification evidence;
- PostgreSQL rejects direct offer remapping without the matching verification record.

### Reporting / commissions

- 30-day financial transaction grouping;
- event gross sales and configured platform-fee evidence;
- successful bill gross value and observed provider commission evidence;
- dispute/reconciliation/payout queue counts;
- provider commission remains operational evidence until settlement/reconciliation accounting establishes recognized income.

### Branding / feature flags / sellability

- audited feature flags;
- audited public brand configuration;
- local deployment profile for `TWIPAY_OWNED`, `WHITE_LABEL` and `ENTERPRISE_SOURCE` editions;
- module entitlement/support metadata;
- no runtime phone-home DRM or dependency on Octalve/OpenAI for a licensed deployment to operate.

## Security hardening added during final Batch 4 review

### Time-bounded MFA assurance

Batch 4 originally treated `mfaSatisfiedAt` as valid for the entire session. It now uses `isRecentMfaAssurance(...)` with `MFA_STEP_UP_MAX_AGE_SECONDS` (default 600 seconds, accepted range 60–3600 seconds). High-risk feature activation, refund approval and organizer payout approval depend on that recent assurance.

**Important boundary:** this repository still does not claim a production-complete user MFA enrollment/challenge journey. Therefore both high-risk money features are seeded disabled. Batch 5 must implement/verify the real MFA enrollment/challenge/step-up journey before either flag is activated.

### Transient idempotency failures

If a pre-commit failure is transient and no resource was attached, the still-`PROCESSING` idempotency row is released instead of poisoning the user's key for the full TTL. Deterministic client/business failures remain replayable.

### Operations error translation

Operations-domain invariant failures are translated into controlled 4xx conflict codes rather than leaking as accidental 500 responses.

### Operations DTO/data minimization

Review found raw Prisma rows could expose JavaScript `bigint` serialization failures and unnecessarily return encrypted columns. Refund, payout, provider and compliance responses now use explicit safe DTOs, decimal-string minor-unit values and masked/minimized fields.

### High-risk feature activation fails closed

Both `events.refunds` and `operations.organizer_payouts` are seeded disabled. The server additionally requires recent MFA when a privileged operator attempts to enable either flag.

## Earlier-source defect found during Batch 4 verification

Strict package verification exposed a Batch 3-origin non-exhaustive return path in `packages/services/src/index.ts` (`normalizeProviderBillStatus`). The final implementation now fails closed with an explicit error for an unsupported status instead of allowing an undefined return path.

This was treated as a real regression found by stronger later verification, not hidden as an environment limitation.

## Executed verification — PASS

| Check | Result |
| --- | --- |
| TypeScript parser/syntax scan | **PASS — 114 source files** |
| Repository security/secret-pattern scan | **PASS — 277 text files** |
| Architecture/provider-boundary scan | **PASS** |
| Financial-invariant scan | **PASS** |
| Services/events-invariant scan | **PASS** |
| Product/operations-invariant scan | **PASS** |
| `git diff --check` | **PASS** |
| `@twipay/contracts` typecheck | **PASS** |
| `@twipay/security` typecheck | **PASS** |
| `@twipay/ledger` typecheck | **PASS** |
| `@twipay/services` typecheck | **PASS** |
| `@twipay/events` typecheck | **PASS** |
| `@twipay/operations` typecheck | **PASS** |
| VTpass adapter typecheck/tests | **PASS — 4/4** |
| Monnify Bills adapter typecheck/tests | **PASS — 2/2** |
| Termii adapter typecheck/tests | **PASS — 1/1** |
| Resend adapter typecheck/tests | **PASS — 1/1** |
| Workspace compiled-runtime import smoke | **PASS — 10 packages** |
| Pure/unit/provider/surface tests | **PASS — 53/53** |

### 53 passing tests

- Contracts/provider-neutrality: 1/1
- Security: 7/7
- Ledger: 7/7
- Services/routing: 6/6
- Events/ticket/accounting rules: 6/6
- Product/operations invariants: 7/7
- VTpass: 4/4
- Monnify Bills: 2/2
- Termii: 1/1
- Resend: 1/1
- Customer product surface: 5/5
- Operations/compliance surface: 6/6

A temporary, ignored local Node type shim/workspace symlink harness was used only because package installation is unavailable. The shim was extended when provider compilation required Node `createHash`; that was a verification-harness limitation, not a source fix. The temporary `node_modules` content is excluded from Git/handoff artifacts.

## PostgreSQL integration tests authored but not executable here

`packages/database/test/product-operations.integration.test.mjs` now covers, among other things:

- operational-audit immutability;
- deployment-profile delete protection;
- provider-offer remap rejection without explicit verification evidence;
- organizer payout maker/checker separation;
- both high-risk flags disabled by default;
- delegated event staff identity immutability and one-way revocation.

Earlier financial/services/events PostgreSQL tests remain part of the regression suite. The Batch 4 integration test file passes JavaScript syntax validation, but the database tests are **not claimed as executed** here.

## Environment blockers — NOT PASSED / NOT CLAIMED

Current host:

- Node: `v22.16.0`
- project engine: Node `>=24 <25`
- global TypeScript: `5.8.3`
- direct `pnpm`: unavailable
- Docker: unavailable
- PostgreSQL/`psql`: unavailable
- Redis server: unavailable
- `pnpm-lock.yaml`: not fabricated/present

Corepack attempted to fetch the pinned `pnpm@12.9.1` and failed with:

```text
getaddrinfo EAI_AGAIN registry.npmjs.org
```

Therefore the following are explicitly **blocked and not claimed as passing**:

- fresh `pnpm install --frozen-lockfile`;
- full Turborepo format/lint/typecheck/test/build;
- dependency-backed Nest API typecheck/build;
- dependency-backed Next.js web/admin typecheck/build;
- Prisma generate/validate;
- migration execution against PostgreSQL 18;
- PostgreSQL integration suite;
- Redis/BullMQ integration suite;
- worker production build/integration;
- Docker smoke/integration testing;
- browser E2E against running API/database/provider sandboxes.

## Mandatory Batch 5 re-verification / activation gates

Use Node 24 LTS in a network-enabled environment and do not enable high-risk flags before all relevant gates pass:

```bash
corepack enable
pnpm install
# Generate and commit a genuine pnpm-lock.yaml from the approved dependency graph.
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm db:generate
# Start PostgreSQL 18 + Redis through the project Docker configuration.
pnpm db:migrate
pnpm --filter @twipay/database test
pnpm build
```

Batch 5 must additionally:

1. implement/verify real MFA enrollment, challenge, recovery and time-bounded step-up;
2. run BOLA/RBAC/CSRF/CSP/rate-limit/session-security tests against the running system;
3. exercise concurrent wallet spend, event capacity, refund and organizer-settlement reservations;
4. exercise duplicate idempotency/webhook/worker retries and UNKNOWN reconciliation;
5. verify Paystack/Monnify/VTpass/Mono/Termii/Resend sandbox boundaries without live customer money;
6. run secret/dependency/SAST/DAST and PII-log checks;
7. validate backup/restore, deployment rollback and incident runbooks;
8. confirm high-risk feature flags remain disabled until finance roles, live provider configuration and MFA are operationally proven.

## Deliberate Batch 4 boundaries

- high-risk refund and organizer payout code is implemented but feature-gated off by default;
- partial event refunds are not enabled;
- provider-fulfilled utility refunds are not fabricated without provider-confirmed reversal evidence;
- actual provider commission recognition remains a settlement/reconciliation accounting concern;
- no automatic SKU equivalence based on names is allowed;
- deployment licensing metadata is local/auditable configuration, not phone-home DRM;
- live provider, database and encryption secrets are not present in this repository/artifact.
