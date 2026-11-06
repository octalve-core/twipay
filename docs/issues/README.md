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
| ISS-009 | S3 | customer-ui | `/auth/user-details` page is dead code (route redirects to login by design) and would break if re-enabled: it sends `country`/`state` but the strict API takes `countryCode`/`stateRegion`, and reads `data.userDetails` which does not exist | OPEN (confirmed by code reading 2026-11-04) | auth review #9 |
| ISS-010 | S3 | api | Login rejects email with surrounding spaces (400); register normalizes | OPEN | auth review #10 |
| ISS-011 | S3 | customer-ui | Marketing mock-up on auth pages shows a fabricated balance and name | OPEN | auth review #11 |
| ISS-012 | S3 | customer-ui | Signed-out public pages call `/auth/me` and `/auth/mfa/status` and log two 401s on every page | OPEN | [ROUTES.md](../screenshots/2026-10-13-customer-routes/ROUTES.md) |
| ISS-013 | S3 | customer-ui | Deferred routes (transfer-funds, international airtime/data, epin, esim, mobile-money, book-flight, hotels, affiliate, referral, virtual-card*) redirect to `/dashboard/services`; `/dashboard/status` redirects to history | WONTFIX (deferred by design: `futureProductRoutes` in `apps/customer-ui/src/lib/constants.ts`) | ROUTES.md |
| ISS-014 | S2 | customer-ui | `@twipay/customer-ui` has 30 type errors (26 unused, 4 real); image builds with `vite build` | OPEN | `pnpm --filter @twipay/customer-ui exec tsc -b` |
| ISS-015 | S3 | process | Demo accounts `demo@`/`admin@twipay.com` passwords are in git history; rotate | OPEN | `docs/tasks/current_tasks.md` |
| ISS-016 | S1 | api | Parallel requests after the touch interval: only one wins the `lastSeenAt` update, the rest got 401 and the UI signed the user out (reproduced: 1x200 + 9x401 per 10 parallel) | FIXED (`SessionService.resolve` re-reads the session; regression tests in `apps/api/test/session-expiry.test.ts`; live race now 10x200) | 2026-11-04 scan |
| ISS-017 | S1 | api/worker | Webhook events claimed as `PROCESSING` stay stuck if the process dies mid-handling; retries get "duplicate" and nothing re-processes them. The worker sweep covers bills and notifications only, not collections/payouts/virtual-account credits | OPEN, design change | `apps/api/src/modules/webhooks/application/webhook.service.ts` |
| ISS-018 | S2 | api | Idempotency keys stuck in `PROCESSING` after a crash block the client for 24 h (409); expired rows are only deleted when the same key is reused, so the table grows | OPEN | `finance/application/idempotency.service.ts` |
| ISS-019 | S2 | api | `createCollection` wraps post-provider bookkeeping in the same `try/catch` as the provider call: a DB error after a successful provider call marks the collection `UNKNOWN` | OPEN | `finance/application/payment.service.ts` |
| ISS-020 | S1 | deps | Next.js 16.3.8 (admin, web) has critical advisories (RCE via SVG image optimization / `use cache`, DoS in Server Actions); fixed in 16.4.1. Source uses neither, exposure likely low | OPEN | `pnpm audit --prod` 2026-11-04 |
| ISS-021 | S1 | deps | customer-ui: `jspdf` <=4.2.0 (critical), `dompurify`, `form-data`, `xmldom`, `html2pdf.js`, `follow-redirects` have critical/high advisories; receipt PDF uses jspdf/html2pdf | OPEN | audit |
| ISS-022 | S2 | deps | `zod` 4.6.5 (api, customer-ui) can exhaust memory on oversized constrained collections; fixed in 4.6.6. 69 advisories in total (7 critical, 31 high), many transitive | OPEN | audit |
| ISS-023 | S3 | docs | `TRANSFER_QUOTE_HMAC_KEY` is read by the API but missing from `.env.example` | OPEN | `apps/api/src/platform/config/env.ts` |

Not yet reviewed at all: the admin journey with a real owner (verified email + `SUPER_ADMIN` + MFA), maker/checker
approvals, every popup/modal/button, mobile widths, accessibility. See [../handoff/NEXT_AGENT_PROMPT.md](../handoff/NEXT_AGENT_PROMPT.md).
