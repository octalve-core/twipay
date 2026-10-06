# TwiPay

TwiPay is an Octalve-owned financial, utility-payment, and event-ticketing platform designed to operate at `twipay.co` while remaining provider-independent and licensable/white-label capable.

## Batch 1 status

Batch 1 establishes the production architecture: monorepo boundaries, Next.js web/admin applications, NestJS/Fastify API, background worker, PostgreSQL/Prisma schema, Redis contract, secure identity/session model, Google OIDC boundary, OpenAPI, local Docker services, repository security checks, CI definitions, and living engineering documentation.

The previous ErhaPay UI is **reference material only**. The legacy API is **reference material only**. New TwiPay business logic must not depend on either legacy architecture.

## Architecture at a glance

- `apps/web` — customer web application
- `apps/admin` — isolated operations/admin application
- `apps/api` — core HTTP API
- `apps/worker` — asynchronous jobs/reconciliation workers
- `packages/database` — Prisma schema and migrations
- `packages/security` — shared security contracts/invariants
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

See `docs/README.md`, `docs/batches/batch-01.md`, and `SECURITY.md` before changing authentication, sessions, authorization, provider code, or financial logic.
