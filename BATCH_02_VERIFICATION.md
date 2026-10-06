# TwiPay Batch 2 Verification Record

**Batch:** 2 — Financial Core
**Batch 1 base:** `a48c6679860401eef0b2859568166ae7d626fe77`
**Batch 2 implementation commit:** `0f4703c691cf4498b67b30c15120293e9973223a`
**Handoff tag:** `batch-02-handoff` (created on the final verification/documentation commit)
**Verification policy:** no check is reported as passing unless it actually executed in this environment.

## Scope verified

Batch 2 implements the TwiPay-owned financial core: double-entry ledger, wallet/holds, immutable financial transactions, user-scoped idempotency, Paystack/Monnify payment provider ports/adapters, verified collections, virtual accounts and virtual-account credits, payouts, webhook inbox/verification, reconciliation foundations, Mono KYC abstraction, sensitive-value encryption/fingerprinting, API ownership guards and permanent documentation.

The legacy ErhaPay backend was not copied into the new core.

## Executed and passed

### Repository/security/architecture gates

```text
node scripts/repository-security-check.mjs
PASS — 161 text files inspected

node scripts/architecture-check.mjs
PASS

node scripts/financial-invariant-check.mjs
PASS

git diff --check
PASS
```

These checks cover, among other things:
- no committed `.env` or obvious payment/private-key material,
- no auth-token localStorage pattern,
- no production `console.log`/`console.debug`/`console.info`,
- provider adapters are imported only through the API provider registry boundary,
- runtime workspaces type-resolve source but import compiled `dist` JavaScript,
- TwiPay wallet has no mutable balance field,
- required financial tables/guards/triggers exist,
- idempotency is user scoped,
- beneficiary/virtual-account numbers are not plaintext columns,
- public webhook verification failures are generic/non-leaking,
- successful/reversed payout evidence requires amount/currency evidence,
- explicit Monnify unsigned-sandbox opt-in is required.

### Pure package compilation

Executed with the installed TypeScript compiler and a temporary, ignored minimal Node type shim because package registry access is unavailable:

```text
tsc -p packages/contracts/tsconfig.json
PASS

tsc -p packages/security/tsconfig.json
PASS

tsc -p packages/ledger/tsconfig.json
PASS

tsc -p packages/providers/payments/paystack/tsconfig.json
PASS

tsc -p packages/providers/payments/monnify/tsconfig.json
PASS

tsc -p packages/providers/identity/mono/tsconfig.json
PASS
```

The temporary shim and temporary `node_modules` were removed before commit/handoff.

### Security unit tests

```text
node --test packages/security/test/security.test.mjs
PASS — 6/6
```

Covered:
- password policy,
- exact browser-origin matching,
- unsafe HTTP method classification for CSRF,
- forbidden browser auth-storage marker remains absent,
- AES-256-GCM sensitive-value round trip with no plaintext exposure,
- deterministic HMAC PII fingerprint that is not plaintext.

### Ledger unit tests

```text
node --test packages/ledger/test/ledger.test.mjs
PASS — 7/7
```

Covered:
- balanced journal acceptance,
- unbalanced journal rejection,
- liability normal-balance math,
- terminal financial-state transition rejection,
- one-way hold lifecycle,
- available balance after active holds,
- idempotency key constraints.

### Provider adapter runtime smoke verification

Compiled adapter output was exercised directly without live credentials/network calls.

**Paystack**
- valid HMAC-SHA512 webhook accepted,
- invalid signature rejected,
- Dedicated NUBAN credit normalized correctly,
- normalized persisted payload did not expose raw account number.

**Monnify**
- valid HMAC-SHA512 webhook accepted,
- `PAID` normalized to success,
- major-unit amount normalized to minor units,
- unsigned production-host webhook rejected even when sandbox compatibility flag is enabled,
- normalized persisted payload did not expose raw account number.

**Mono**
- malformed BVN rejected locally before any provider fetch was attempted.

Result: `Provider adapter runtime smoke PASS`.

### Workspace runtime export verification

After locally compiling the pure workspace packages, Node successfully resolved/imported:

```text
@twipay/contracts
@twipay/security
@twipay/ledger
@twipay/provider-paystack
@twipay/provider-monnify
@twipay/provider-mono
```

Result: `Workspace runtime export resolution PASS`.

### TypeScript syntax pass

Using the installed TypeScript compiler API, all application/package `.ts`/`.tsx` source files (excluding generated output/declarations) were transpile-parsed:

```text
TypeScript syntax transpile PASS — 56 source files
```

This is a syntax verification only; it is not represented as a substitute for the full dependency-backed workspace typecheck.

## Source-review defects found and fixed before commit

The review did not merely run checks; it found and corrected real defects before the implementation commit:

1. Financial transaction `userId` was nullable in the domain/Prisma model but initially non-null in the SQL migration. Migration corrected to allow legitimate system transactions.
2. Idempotency originally risked cross-user key collision; uniqueness is now `(userId, scope, key)`.
3. Beneficiary and virtual-account numbers were moved to AES-256-GCM ciphertext + HMAC fingerprint + last-four display only.
4. Paystack asynchronous DVA assignment and verified DVA funding settlement were completed.
5. Payout success/reversal now requires exact provider amount/currency evidence before financial mutation.
6. Deterministic insufficient-balance failure is persisted into idempotency replay instead of leaving the key stuck `PROCESSING`.
7. Verified/recent in-flight KYC is reused before provider-call throttling, preventing unnecessary billable calls.
8. Monnify unsigned sandbox webhook behavior changed from implicit non-production allowance to explicit opt-in only; production host never accepts unsigned webhook events.
9. Provider adapter instances are cached so Monnify OAuth token caching persists across calls.
10. PostgreSQL now independently guards financial instruction immutability/state transitions, wallet-ledger ownership/currency/category, provider-operation identity, and bank-transfer instruction/state transitions.
11. Expired wallet holds no longer masquerade as explicitly released holds.
12. Invalid webhook signature/parser errors are normalized to a generic `WEBHOOK_VERIFICATION_FAILED` response without leaking provider internals.
13. Virtual-account settlement had TypeScript narrowing paths that could leave amount/currency optional inside transaction callbacks; stable verified values now carry the narrowed types.
14. Shared/provider package exports were corrected so typechecking sees source declarations while production Node imports compiled `dist` JavaScript.
15. API responses now default to `Cache-Control: no-store` to avoid caching user-specific financial/KYC/session state.

## Database integration tests authored but not executable here

`packages/database/test/financial-core.integration.test.mjs` covers PostgreSQL rejection of:
- unsealed/unbalanced journals,
- appending to sealed journals,
- journal-entry mutation,
- cross-currency posting,
- duplicate reversal,
- wallet-hold amount rewrite,
- wallet linked to another user's ledger account,
- financial instruction rewrite,
- illegal financial state transition,
- bank-transfer instruction rewrite.

It also verifies legitimate system financial transactions with `userId = NULL`.

These tests were **not executed** because this environment has no PostgreSQL server/client or Docker and cannot install Prisma dependencies.

## Checks blocked by the execution environment

### Dependency installation / complete workspace verification

The repository requires Node 24 and `pnpm@12.9.1`. The execution host currently has Node `v22.16.0` and Corepack cannot download pnpm because DNS/network access to the npm registry fails:

```text
getaddrinfo EAI_AGAIN registry.npmjs.org
```

Therefore the following are **NOT claimed as passed**:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @twipay/database prisma:validate
pnpm --filter @twipay/database prisma:deploy
```

A `pnpm-lock.yaml` is also intentionally not fabricated. CI fails closed until a genuine lockfile is generated from a normal network-enabled Node 24 checkout and committed.

### Full API typecheck

`tsc -p apps/api/tsconfig.json --noEmit` cannot be meaningfully completed without installed Nest/Fastify/Zod/Prisma types and generated Prisma Client. The attempted check reports missing external modules/client types. During that attempt, two independent local type defects were exposed in TwiPay code (ledger currency narrowing and virtual-account settlement amount/currency narrowing); both were fixed before the implementation commit. No remaining non-dependency type-error category was observed in the final dependency-missing output, but only the real Node-24/pnpm dependency-backed CI run can certify the full API typecheck.

### PostgreSQL/Redis/Docker integration

Unavailable commands on this host:

```text
docker
psql
postgres
redis-server
```

No DB/Redis concurrency or migration execution is represented as passed here.

### Live provider certification

No Paystack, Monnify or Mono production/test secret was requested or stored. Live/sandbox certification, source-IP allowlisting and real provider behavior remain deployment/integration checkpoints, not fabricated tests.

## Mandatory verification in the first normal network-enabled checkout

Use Node 24, then:

```powershell
corepack enable
pnpm install
pnpm db:generate
pnpm --filter @twipay/database prisma:validate
pnpm test:repo
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

With PostgreSQL/Redis running against a disposable test database:

```powershell
pnpm --filter @twipay/database prisma:deploy
pnpm --filter @twipay/database test
```

Do not connect live money until all of those pass plus provider sandbox certification.

## Deliberate Batch 2 boundaries

- Provider clearing journals represent **gross principal**, not final processor settlement cash. Provider fees/refunds must be posted from verified settlement evidence later; TwiPay does not guess fees.
- Product fraud limits, transaction limits and step-up thresholds require approved business/compliance policy; no arbitrary values were invented in Batch 2.
- Webhook processing is durably persisted/deduplicated but still processed synchronously after claim; queue/worker acknowledgement hardening remains pre-launch work in Batch 3/5.
- Provider accounts requiring payout OTP/manual authorization remain safely non-terminal (`REQUIRES_ACTION`/hold retained); that rail is not declared automated until configuration/flow is certified.

## Next batch

Batch 3 is **Services & Events**. The exact continuation brief is stored at `docs/batches/batch-03-continuation-prompt.md`.
