# Current Operational & Deployment Tasks

- **Workstream Code:** `TASK-CURRENT`
- **Start Date & Time:** `2026-10-08T15:20:00Z` (04:20:00 PM WAT)
- **Status:** `IN_PROGRESS`
- **Lead / Execution:** TwiPay Platform Engineering

---

## 1. Active Service Deployments & Runtime Health

### Backing Infrastructure (Docker)
- [x] **PostgreSQL 18 Alpine**:
  - Container: `twipay-postgres-1`
  - Internal port: `5432` | Host port: `127.0.0.1:5435`
  - Health check: `pg_isready -U twipay -d twipay` (Passing)
- [x] **Redis 8 Alpine**:
  - Container: `twipay-redis-1`
  - Internal port: `6379` | Host port: `127.0.0.1:6382`
  - Health check: `redis-cli ping` (Passing)

### Application Services
- [x] **Core API Service (`apps/api`)**:
  - Port: `http://localhost:4000`
  - Runtime: Compiled production bundle (`dist/main.js`) with Fastify
  - OpenAPI Docs: `http://localhost:4000/docs`
  - Status: Active, listening, serving requests
- [x] **Customer Web Portal (`apps/web`)**:
  - Port: `http://localhost:3000`
  - Runtime: Next.js 16 standalone server
  - Status: Active, serving UI routes
- [x] **Operations & Admin Console (`apps/admin`)**:
  - Port: `http://localhost:3001`
  - Runtime: Next.js 16 standalone server
  - Status: Active, serving operations console

---

## 2. Authentication & Access Verification

### Customer Portal Authentication
- [x] Portal URL: `http://localhost:3000/login`
- [x] Test Credentials:
  - **Email:** `demo@twipay.com`
  - **Password:** `Password12345!`
- [x] Verified Behaviors:
  - Session cookie (`twipay_session`) and CSRF token (`twipay_csrf`) generated.
  - Automatic on-demand ledger wallet provisioning on first dashboard access (`/v1/wallets`).
  - Overview metrics, recent ledger activity, and event marketplace rendering cleanly.

### Operations / Admin Portal Authentication
- [x] Console URL: `http://localhost:3001/login`
- [x] Admin Credentials:
  - **Email:** `admin@twipay.com`
  - **Password:** `AdminPassword123!`
- [x] Role & Permission Provisioning:
  - Role: `SUPER_ADMIN` assigned in PostgreSQL `user_roles`.
  - Permissions: Full administrative suite (`ops.dashboard.read`, `ops.disputes.review`, `ops.compliance.read`, `ops.refunds.prepare`, `ops.refunds.approve`, `ops.payouts.prepare`, `ops.payouts.approve`, `ops.providers.manage`, `ops.catalog.map`, `ops.feature_flags.manage`, `ops.branding.manage`, `ops.reports.read`, `ops.audit.read`).
- [x] Verified Behaviors:
  - Operations dashboard loaded at `/` with financial metrics, transaction count breakdown, and open queue counters.

---

## 3. Remote Ingress & Tunnel Management
- [x] **Pinggy SSH Tunnel Verification**:
  - Demonstrated remote HTTPS ingress for port 3000, 3001, and 4000.
  - Identified 60-minute duration cap on unauthenticated Pinggy sessions.
- [/] **Remote Access Hardening**:
  - Plan persistent ingress via Cloudflare Tunnel, ngrok, or untun for longer remote sessions.
  - Align `APP_URL` and `ADMIN_URL` CORS origins for remote ingress domains.

---

## 4. Pending / In-Flight Backlog
- [ ] **MFA Step-Up UI Flow**:
  - Verify TOTP QR enrollment and recovery code generation in customer `/profile` and ops console.
- [ ] **Asynchronous Worker Integration**:
  - Start `apps/worker` daemon for BullMQ background transaction sweeps and webhook retries.
- [ ] **Provider Sandbox Verification**:
  - Execute end-to-end sandbox funding with Paystack and Monnify mock webhooks.
