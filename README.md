# TwiPay

TwiPay is an Octalve-owned financial, utility-payment, and event-ticketing platform designed to operate at `twipay.co` while remaining provider-independent and licensable/white-label capable.

## Batch 2 status

Batch 1 established the platform/identity foundation. Batch 2 adds the financial core: immutable double-entry ledger, derived wallets and holds, user-scoped idempotency, funding/payout/virtual-account orchestration, Paystack and Monnify payment adapters, Mono BVN/NIN verification, signed webhook inbox/deduplication and reconciliation foundations.

The previous ErhaPay UI is **reference material only**. The legacy API is **reference material only**. New TwiPay business logic must not depend on either legacy architecture.

## Architecture at a glance

- `apps/web` — customer web application
- `apps/admin` — isolated operations/admin application
- `apps/api` — core HTTP API
- `apps/worker` — asynchronous jobs/reconciliation workers
- `packages/database` — Prisma schema and migrations
- `packages/ledger` — pure money/state invariants
- `packages/security` — shared security contracts/invariants and sensitive-value cryptography
- `packages/contracts` — provider-neutral API/domain contracts
- `packages/providers` — external provider adapters only
- `docs` — architecture, ADRs, security, runbooks and batch records

## Local prerequisites

- Node.js 24 LTS
- pnpm 12.9.1 through Corepack
- Docker + Docker Compose

## First local setup

```bash
corepack enable
pnpm install
cp .env.example .env
# Fill LOCAL-ONLY development values. Never commit .env.
docker compose up -d postgres redis
pnpm db:generate
pnpm db:migrate
pnpm dev
```

## Mandatory verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:repo
```

See `docs/README.md`, `docs/batches/batch-01.md`, `docs/batches/batch-02.md`, `docs/architecture/financial-core.md`, and `SECURITY.md` before changing authentication, sessions, authorization, provider code, ledger/accounting, KYC, or financial logic.
