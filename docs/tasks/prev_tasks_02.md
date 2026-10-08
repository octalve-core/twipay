# Milestone 02: Docker Backing Services, PostgreSQL 18 / Redis 8 & Prisma 7 Migration

- **Milestone Code:** `TASK-MILESTONE-02`
- **Start Date & Time:** `2026-10-08T12:45:00Z` (01:45:00 PM WAT)
- **End Date & Time:** `2026-10-08T14:15:00Z` (03:15:00 PM WAT)
- **Status:** `COMPLETED`
- **Lead / Execution:** TwiPay Platform Engineering

---

## 1. Objective & Scope
Provision isolated containerized backing infrastructure using Docker, resolve local host port collisions on default ports, configure 256-bit cryptographic secrets, deploy all 5 Prisma 7 database migrations, adopt the `@prisma/adapter-pg` driver adapter, and resolve PostgreSQL advisory locking deserialization failures.

---

## 2. Tasks Executed

### Task 02.1: Docker Backing Infrastructure & Port Remapping
- [x] Detected pre-existing local host processes on standard ports `5432` and `6379`.
- [x] Configured `compose.yaml` with dedicated container port mappings and health checks:
  - **PostgreSQL 18 Alpine**: `127.0.0.1:5435 -> 5432` (Container: `twipay-postgres-1`)
    - Health check: `pg_isready -U twipay -d twipay`
  - **Redis 8 Alpine**: `127.0.0.1:6382 -> 6379` (Container: `twipay-redis-1`)
    - Health check: `redis-cli ping`
- [x] Launched backing containers via `docker compose up -d` and confirmed healthy status.

### Task 02.2: Cryptographic Secrets & Environment Configuration
- [x] Generated cryptographically strong secrets in `.env`:
  - `DATA_ENCRYPTION_KEY`: 32-byte Base64-encoded key (`zod` schema validated).
  - `PII_FINGERPRINT_KEY`: 32-byte Hex-encoded HMAC key.
  - `MFA_RECOVERY_HMAC_KEY`: 32-byte Hex-encoded key for recovery code validation.
  - `TICKET_SIGNING_KEYS_JSON`: Valid JSON string mapping key version `1` to 32-byte Base64 HMAC secret.
  - Updated connection strings:
    - `DATABASE_URL=postgresql://twipay:development_password@127.0.0.1:5435/twipay?schema=public`
    - `REDIS_URL=redis://127.0.0.1:6382`

### Task 02.3: Prisma 7 Configuration & Database Migrations
- [x] Authored `packages/database/prisma.config.ts` defining datasource URL and migrations directory path.
- [x] Applied all 5 sequential database migrations to PostgreSQL 18 in Docker:
  1. `0001_identity_foundation`: Users, credentials, sessions, security events, audit logs.
  2. `0002_financial_double_entry_ledger`: Accounts, journal entries, ledger postings, double-entry constraints.
  3. `0003_utility_services_and_events`: Event ticketing, capacity reservations, utility bill orders.
  4. `0004_product_operations_hardening`: Dispute cases, refunds, feature flags, KYC tiers, provider routing.
  5. `0005_production_hardening_mfa`: TOTP secrets, recovery code hashes, MFA assurance tracking.

### Task 02.4: Prisma 7 Driver Adapter & Advisory Locking Fix
- [x] Added `@prisma/adapter-pg` and `pg` dependencies to `@twipay/database` and `apps/api`.
- [x] Configured `PrismaService` (`apps/api`) to construct `PrismaPg` adapter instances from the configured `DATABASE_URL`.
- [x] Replaced `tx.$queryRaw` with `tx.$executeRaw` for `SELECT pg_advisory_xact_lock(...)` in:
  - `EventService.checkout` (`apps/api/src/modules/events/application/event.service.ts`)
  - `PaymentService.ingestWebhook` (`apps/api/src/modules/finance/application/payment.service.ts`)
- [x] Resolved PostgreSQL `void` column deserialization error during transactional concurrency.

---

## 3. Verification & Artifacts
- **Docker Health:** Both `twipay-postgres-1` and `twipay-redis-1` status `Up (healthy)`.
- **Migration Status:** `prisma migrate status` verified all 5 migrations applied cleanly.
- **Architectural Records:** 
  - [ADR 016: Prisma 7 Driver Adapter & Docker Backing Services](file:///home/rojitech/Desktop/CODEC/OCTALVE/twipay/docs/adr/016-prisma-7-driver-adapter-and-docker-backing-services.md)
  - [ADR 017: Transactional Advisory Locking Execution via $executeRaw](file:///home/rojitech/Desktop/CODEC/OCTALVE/twipay/docs/adr/017-transactional-advisory-locking-and-concurrency.md)
