# ADR 016 — Prisma 7 Driver Adapter & Containerized Backing Services

**Status:** Accepted

## Context
TwiPay upgrades to Prisma 7.x (`@prisma/client@7.10.0` and `prisma@7.10.0`). In Prisma 7, direct connections without a driver adapter are prohibited when initializing `PrismaClient` in Node.js environments. Additionally, developer and CI host environments frequently run standard local PostgreSQL and Redis services on default ports `5432` and `6379`.

## Decision
1. **Explicit Driver Adapter:** All Prisma client instantiations across `@twipay/api` (`PrismaService`) and `@twipay/database` integration tests use `@prisma/adapter-pg` coupled with `pg` connection pools reading `DATABASE_URL`.
2. **Containerized Isolated Backing Services:** Development and test backing infrastructure runs on Docker with pinned versions:
   - PostgreSQL 18 Alpine mapped to host port `127.0.0.1:5435:5432`
   - Redis 8 Alpine mapped to host port `127.0.0.1:6382:6379`
   This eliminates host port collisions while ensuring identical containerized environments across host machines and CI pipelines.
3. **Configuration Schema:** `prisma.config.ts` manages declarative datasource URLs and migration paths for CLI operations (`prisma migrate deploy`, `prisma generate`).

## Consequences
- Clean execution in native Node.js ESM environments without native query engine mismatch.
- Reproducible, isolated development database instances without risk of mutating host machine system databases.
