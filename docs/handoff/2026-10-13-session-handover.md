# Session handover — 2026-10-13

For the next engineer or AI agent. Start with [NEXT_AGENT_PROMPT.md](NEXT_AGENT_PROMPT.md). History of this window:
[tasks/prev_tasks_04.md](../tasks/prev_tasks_04.md). Live backlog: [tasks/current_tasks.md](../tasks/current_tasks.md).
Findings: [issues/README.md](../issues/README.md).

## State
- Branch `dev` (pushed to `origin/dev`), 113 commits ahead of `origin/master`; **no PR opened, master untouched**.
- Uncommitted by design: `apps/admin/app/layout.tsx` carries the owner's formatting-only change; leave it unless asked.
- Phase 3 source is merged (incoming side won); the temporary `new/` checkout is gone. `pnpm test:repo` passes;
  offline regression 489/489; `@twipay/api` tsc clean; `@twipay/customer-ui` has 30 type errors (ISS-014).
- Production is **not** approved (`docs/release/security-gates.md`).

## Run it
`docker compose -f compose.stack.yaml up -d --build` (see [development/docker-stack.md](../development/docker-stack.md)).
Customer UI 3002 on this machine (3000 belongs to an unrelated app; do not kill it), admin 3001, API 4000, dev inbox 8025,
Postgres 5435, Redis 6382. Front ends bake the API URL in at build time: if you change origins, rebuild.
The current images were built for the Tailscale Funnel origins `https://rojitech.taildf7871.ts.net` (:8443 admin, :10000 API)
and Funnel may still be ON (`sudo tailscale funnel status`; turn off with `sudo tailscale funnel reset`). To drive those
origins without network access use `REVIEW_PUBLIC_HOST` in the [review harness](../../scripts/review-harness/README.md);
otherwise rebuild with default localhost origins.

## Things that will bite you
- API `pnpm dev` does not work (tsx emits no decorator metadata -> Nest DI undefined -> 500). Use the tsc build / Docker.
- `api` and `migrate` share one image; rebuild with `build migrate`.
- Browser calls to the API need an allowed `Origin` (403 `ORIGIN_NOT_ALLOWED`) and unsafe calls the `x-csrf-token` header.
- Login/register share a 10/min per-IP in-memory bucket; restart the API before brute-force probes. Behind a proxy set
  `STACK_TRUST_PROXY=true`.
- Cookies are `SameSite=Strict`; keep UI/admin/API on one hostname.
- A `(void 0)` statement on its own line gets glued to the previous line by ASI. Write `void 0;`.
- Admin/owner area is fail-closed: needs verified contact + `SUPER_ADMIN` (table `user_roles`: userId, roleId, assignedAt,
  assignedBy; roles AUDITOR, COMPLIANCE, FINANCE_APPROVER, FINANCE_OPERATOR, OPERATIONS, SUPER_ADMIN, SUPPORT_AGENT) + TOTP MFA
  (`/v1/auth/mfa/enroll`, `/enroll/confirm`, `/challenge`). Approvals are maker/checker: two distinct owners. So to review the
  admin area you must create two users, verify their emails via the dev inbox, grant `SUPER_ADMIN` in the database, and enrol MFA
  (compute TOTP codes from the secret with any RFC 6238 implementation).
- `scripts/repository-security-check.mjs` scans the whole tree and bans `console.*` in app code (`scripts/` is exempt):
  keep nested checkouts out of the repo; run `pnpm test:repo` before committing.
- ErhaPay UI inventory (`docs/design/ERHAPAY_COMPONENT_INVENTORY.json`) must be regenerated after customer-ui source changes
  (review the diff, then the repo's `--write` option).
- Registry is slow here; long installs/builds are normal.

## Surface map
- Admin pages: `/`, `/audit`, `/compliance`, `/config`, `/exceptions`, `/financial-tiers`, `/login`, `/notifications`, `/owner`,
  `/owner/customers`, `/owner/staff`, `/payouts`, `/providers`, `/refunds`, `/reports`, `/security`, `/support`.
- Customer routes: `apps/customer-ui/src/App.tsx` (public pages, `/auth/*`, `/dashboard/*`, `/receipt`).
- Dev inbox widget and API: `infrastructure/dev-mail/`, ADR 021.

## Reviewed vs not reviewed
Reviewed with evidence: customer sign-up, verify, login, logout, reset, rate limit, route guards, admin login screen, dev inbox,
and a render-only sweep of every customer route ([ROUTES.md](../screenshots/2026-10-13-customer-routes/ROUTES.md)).
**Not reviewed:** `/auth/user-details`, set-pin, verify-phone, 2FA UI, Google flow; every dashboard feature behind its buttons
and popups; the whole admin app past login; customer-vs-admin cross-flows (e.g. customer action -> appears in admin queue);
mobile widths; accessibility. Many routes redirect to `/dashboard/services` (ISS-013) — find out why first.

## Decisions waiting on the owner
Merge `dev` -> `master`; registration enumeration (ISS-002); password policy; lockout strategy; whether to keep Funnel on;
rotation of the demo passwords (ISS-015).

## Hygiene
Never commit secrets or real credentials; test accounts are `@example.test`. Commit in small conventional commits; the git
identity is the repository's configured one.
