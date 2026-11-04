# Issues

Defects, risks and UX problems found by review. One row per issue; details live in the linked note or a file named
after the ID (copy [_template.md](_template.md)). Keep this index current: when you fix something, set `Status` to
`FIXED (commit)`, never delete the row.

Product walkthrough findings use their own `WT-NN` IDs: see [WALKTHROUGH_FINDINGS_2026-11-04.md](WALKTHROUGH_FINDINGS_2026-11-04.md).

Severity: `S1` blocks a core journey or leaks data, `S2` wrong behaviour with workaround, `S3` polish.
Status: `OPEN`, `IN PROGRESS`, `FIXED`, `WONTFIX (reason)`, `DECISION NEEDED` (product/owner call).

| ID | Sev | Area | Issue | Status | Evidence |
| :-- | :-- | :--- | :--- | :--- | :--- |
| ISS-001 | S2 | auth | Password policy is length-only (12-128); reset screen shows an uppercase rule the server does not enforce | OPEN | [auth review #1](../security/auth-review-2026-10-13.md) |
| ISS-002 | S2 | auth | Registration `409 ACCOUNT_ALREADY_EXISTS` reveals registered emails | DECISION NEEDED | auth review #2, `screenshots/2026-10-13-auth-review/06-*` |
| ISS-003 | S2 | auth | No per-account lockout; limiter is per-IP and in-memory | OPEN | auth review #3 |
| ISS-004 | S3 | ops | Behind a proxy without `TRUST_PROXY=true` all clients share one rate-limit bucket | FIXED in compose (`STACK_TRUST_PROXY`) | auth review #4 |
| ISS-005 | S2 | auth | Session/CSRF cookies `Secure=false` in development; confirm production | OPEN | auth review #5 |
| ISS-006 | S3 | auth | Password-reset email delayed 20-60 s by worker sweep | OPEN | auth review #6 |
| ISS-007 | S1 | admin | Admin with unverified email sees raw `CONTACT_VERIFICATION_REQUIRED`; no verification screen, staff locked out | OPEN | auth review #7, `screenshots/2026-10-13-auth-review/10-*`, `11-*` |
| ISS-008 | S2 | customer-ui | Forms other than login/sign-up read `errData.message` from a possibly undefined body | OPEN | auth review #8 |
| ISS-009 | S2 | customer-ui | `/auth/user-details` untested; typechecker reports `userDetails` missing on `Profile`, `country` unknown | OPEN | auth review #9 |
| ISS-010 | S3 | api | Login rejects email with surrounding spaces (400); register normalizes | OPEN | auth review #10 |
| ISS-011 | S3 | customer-ui | Marketing mock-up on auth pages shows a fabricated balance and name | OPEN | auth review #11 |
| ISS-012 | S3 | customer-ui | Signed-out public pages call `/auth/me` and `/auth/mfa/status` and log two 401s on every page | OPEN | [ROUTES.md](../screenshots/2026-10-13-customer-routes/ROUTES.md) |
| ISS-013 | S3 | customer-ui | Deferred routes (transfer-funds, international airtime/data, epin, esim, mobile-money, book-flight, hotels, affiliate, referral, virtual-card*) redirect to `/dashboard/services`; `/dashboard/status` redirects to history | WONTFIX (deferred by design: `futureProductRoutes` in `apps/customer-ui/src/lib/constants.ts`) | ROUTES.md |
| ISS-014 | S2 | customer-ui | `@twipay/customer-ui` has 30 type errors (26 unused, 4 real); image builds with `vite build` | OPEN | `pnpm --filter @twipay/customer-ui exec tsc -b` |
| ISS-015 | S3 | process | Demo accounts `demo@`/`admin@twipay.com` passwords are in git history; rotate | OPEN | `docs/tasks/current_tasks.md` |

Not yet reviewed at all: the admin journey with a real owner (verified email + `SUPER_ADMIN` + MFA), maker/checker
approvals, every popup/modal/button, mobile widths, accessibility. See [../handoff/NEXT_AGENT_PROMPT.md](../handoff/NEXT_AGENT_PROMPT.md).
