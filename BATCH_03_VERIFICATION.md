# TwiPay Batch 3 Verification Record

## Immutable reference

- Batch 2 required base: `ce9f5515f128922bcef8826a63a51a109aef642a` (`batch-02-handoff`)
- Batch 3 implementation commit: `aeb0a2d22be7e1cb1d564fc31039b42e5325ea71`
- Scope: Services & Events
- Legacy ErhaPay/Data Arena architecture was not copied into the TwiPay core.

This record distinguishes **executed verification** from checks that cannot run in the current execution environment. A blocked check is not a pass.

## Implementation covered

### Services / bills

- provider-neutral bill contracts and service-domain state machine;
- normalized TwiPay product catalogue with provider offers;
- VTpass adapter;
- Monnify Bills adapter;
- provider health/routing/circuit-breaker foundation;
- catalog synchronization with stale-offer deactivation;
- encrypted customer identifiers and provider validation evidence;
- wallet-funded bill purchases using Batch 2 financial transactions, holds, ledger and idempotency;
- provider request/query reference allocated and persisted before network submission;
- same-provider bounded reconciliation with exponential backoff;
- exact amount/currency evidence requirement for terminal monetary outcomes;
- no blind post-submission provider failover;
- service-provider clearing accounting and immutable compensating reversal journals.

### Events

- organizers and system-owned settlement-liability accounts;
- events, publishing, ticket types and capacity;
- wallet-funded user-scoped idempotent checkout;
- serializable checkout and deterministic ticket-type advisory locks;
- event order/line financial snapshots;
- organizer settlement liability and configurable platform-fee revenue accounting;
- `EVENT_PLATFORM_FEE_BPS` defaults to zero; Batch 3 invents no commercial fee;
- encrypted, HMAC-authenticated opaque QR credentials with key versioning;
- ticket issuance constrained to paid/purchased quantity;
- one-time organizer-owner check-in for V1;
- event receipt notification hook;
- event refunds remain intentionally disabled until a compensating-ledger workflow is implemented atomically.

### Notifications / worker

- provider-neutral notification port;
- Termii SMS adapter;
- Resend email adapter;
- encrypted notification destination/body;
- idempotent notification records, attempt history and bounded retries;
- BullMQ worker handlers plus bounded database recovery sweep;
- worker reuses API application services through a non-HTTP Nest application context and performs the same environment validation.

### Database defense in depth

Migration `0003_services_events` contains guards for bill financial consistency, immutable provider request references, service state transitions, event financial/order consistency, exact event fee matching, immutable order lines/ticket credentials, ticket issuance quantity, check-in state, organizer ledger configuration, and disabled refund transitions.

## Material defects discovered and repaired during Batch 3 review

### Batch 2-origin TypeScript syntax defect

A repository-wide syntax pass found malformed Batch 2 code in `apps/api/src/modules/finance/application/payment.service.ts`: an evidence object contained `verifiedCurrency ?? null` instead of a property assignment. It was repaired as:

```ts
verifiedCurrency: verified.currency ?? null
```

This was treated as a real regression discovered by stronger Batch 3 verification, not hidden as an environment problem.

### VTpass UNKNOWN/requery defect

VTpass requery requires the original provider `request_id`. An early Batch 3 adapter version generated that value only inside the outbound call, which could leave TwiPay unable to reconcile a timeout after VTpass had accepted the request.

The final implementation now:

1. asks the selected provider adapter for the provider request reference before any provider network call;
2. persists it with the bill purchase in the database transaction;
3. marks provider submission;
4. sends exactly that persisted reference to the provider; and
5. reuses exactly that same reference for requery.

Ambiguous VTpass response code `000` without explicit nested success evidence is not manufactured into success; it remains `UNKNOWN`.

### Event fee consistency

The database insert guard now requires the immutable `EVENT_PURCHASE.feeMinor` to equal `event_orders.platformFeeMinor`, in addition to user/amount/currency/type consistency.

### Strict environment access

Server/worker TypeScript was normalized from `process.env.KEY` to `process.env['KEY']` to comply with `noPropertyAccessFromIndexSignature`. No secret values were introduced.

## Executed verification — PASS

All commands below were executed against the Batch 3 working tree before the implementation commit, followed by static checks again after final hardening.

| Check | Result |
| --- | --- |
| TypeScript parser/syntax scan | **PASS — 75 source files** |
| Repository security/secret-pattern scan | **PASS — 217 text files** |
| Architecture/provider-boundary scan | **PASS** |
| Batch 1/2 financial-invariant scan | **PASS** |
| Batch 3 services/events-invariant scan | **PASS** |
| `git diff --check` | **PASS** |
| `@twipay/contracts` typecheck | **PASS** |
| `@twipay/security` typecheck | **PASS** |
| `@twipay/ledger` typecheck | **PASS** |
| `@twipay/services` typecheck | **PASS** |
| `@twipay/events` typecheck | **PASS** |
| VTpass adapter typecheck | **PASS** |
| Monnify Bills adapter typecheck | **PASS** |
| Termii adapter typecheck | **PASS** |
| Resend adapter typecheck | **PASS** |
| Compiled runtime import smoke | **PASS — 9 packages** |
| Pure unit/provider tests | **PASS — 32/32** |

### 32 passing tests

- Security: 6/6
- Ledger: 7/7
- Services/routing: 6/6
- Events/ticket credentials: 5/5
- VTpass: 4/4
- Monnify Bills: 2/2
- Termii: 1/1
- Resend: 1/1

The VTpass suite explicitly covers authentication-header separation and the rule that ambiguous response codes do not manufacture success. The event suite covers capacity, state transitions, integer fee calculation, settlement, and QR tamper detection.

## Integration tests authored but not executable here

`packages/database/test/financial-core.integration.test.mjs` contains PostgreSQL-backed Batch 3 regression cases, including:

- bill financial instruction/provider-reference immutability;
- illegal service status transition rejection;
- `EVENT_PURCHASE` direct-settlement guard;
- event order financial amount/currency/type consistency;
- event platform-fee consistency;
- immutable order lines;
- paid-order requirement for ticket issuance;
- issuance quantity limit;
- immutable ticket credentials;
- disabled refund transition;
- active-only, immutable ticket check-in with database-driven checked-in state;
- organizer settlement-ledger configuration.

These tests are **authored, not claimed as executed** in this environment.

## Environment blockers — NOT PASSED / NOT CLAIMED

The current execution host is not the project runtime target:

- host Node: `v22.16.0`
- project engine: Node `>=24 <25`
- global TypeScript: `5.8.3`
- `pnpm`: not installed locally
- Docker: unavailable
- PostgreSQL/`psql`: unavailable
- Redis server: unavailable

Corepack attempted to fetch `pnpm@12.9.1` and failed with:

```text
getaddrinfo EAI_AGAIN registry.npmjs.org
```

A no-install Prisma invocation also could not complete because the required local toolchain is not installed/available.

Therefore the following are explicitly **blocked and not claimed as passing**:

- fresh `pnpm install --frozen-lockfile`;
- full Turborepo lint/typecheck/test/build;
- Prisma generate/validate;
- migration execution against PostgreSQL 18;
- PostgreSQL integration tests;
- Redis/BullMQ integration tests;
- full Nest API production build;
- Next.js web/admin production builds;
- worker production build;
- Docker integration/smoke testing.

A no-install API TypeScript invocation was also attempted. It reaches the source but fails because this partial environment does not contain Nest/Fastify/Zod/Prisma generated dependencies/types. Those missing types also create consequential inferred-`any`/Prisma-property diagnostics; they are not being misreported as a successful full API typecheck.

## Required re-verification in a normal engineering environment

Use Node 24 LTS, then execute at minimum:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm test:repo
pnpm lint
pnpm typecheck
pnpm test
pnpm db:generate
# Start PostgreSQL 18 + Redis through the project Docker configuration.
pnpm db:migrate
pnpm --filter @twipay/database test
pnpm build
```

Any failure must be repaired and committed; do not waive it because the source-level checks in this record passed.

## Deliberate Batch 3 boundaries

These are not accidental omissions:

- automatic cross-provider SKU equivalence is not guessed; verified mapping/operations control belongs in Batch 4;
- failover is only safe before possible provider submission; after submission TwiPay reconciles against the same provider;
- event refunds/chargebacks are not enabled until compensating ledger accounting is implemented atomically;
- organizer bank payout workflow is Batch 4;
- delegated event staff roles are Batch 4;
- free tickets are not enabled in V1 Batch 3;
- provider delivery-receipt webhooks for notifications may enrich `ACCEPTED` later, but accepted dispatches are not blindly resent.

## Security conclusions

Batch 3 does not weaken Batch 1/2 controls:

- no provider secrets in browser code;
- no auth tokens moved to `localStorage`;
- session/CSRF/exact-origin model retained;
- ledger journals remain immutable/sealed and reversals compensating;
- money remains integer minor units;
- financial idempotency remains user-scoped;
- PII/provider evidence/QR data are encrypted or fingerprinted as appropriate;
- ambiguous provider outcomes remain `UNKNOWN` and enter reconciliation;
- no post-submission cross-provider retry is permitted;
- event ticket credentials are opaque/tamper evident;
- database constraints/triggers provide defense beneath application code.

## Next scope

Batch 4 is **Product Experience & Operations**. Follow `docs/batches/batch-04-continuation-prompt.md` and preserve every Batch 1–3 security/accounting invariant.
