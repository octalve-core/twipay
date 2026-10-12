# Phase 2 / Batch 2.3 — ErhaPay customer routes, shells and navigation

## Scope and authority

- Baseline: original ErhaPay React/Vite UI as retained under `apps/customer-ui`, **not** the simplified `apps/web` Next.js reference.
- Git parent: Phase 2.2 `1cd96f7ec4411d1d4a3b851484a12a33a460aa40`.
- This is a source-level route/layout hardening checkpoint. There is **no evidence of a successful Node 24/Vite build, Playwright execution, production hosting or database-backed authentication** in this environment.
- All existing financial gates remain default-off; backend authorization/ledger rules are unchanged. React route guards provide navigation UX/defense in depth, **not a backend security boundary**.

## Existing route and layout matrix

| Shell | Current source | Behaviour / constraint |
|---|---|---|
| Public | `MainLayout.tsx` | Original navbar, footer, scroll reset; `/`, about, contact, FAQs, privacy and terms |
| Authentication | `AuthLayout.tsx` | Original auth pages for login, signup and MFA. Phone/email confirmation, account details, transaction PIN and password reset routes intentionally redirected inactive pending Phase 3. |
| Customer dashboard | `DashboardLayout.tsx` | Original sidebar on desktop; header/mobile drawer, fixed viewport content shell; session and MFA required; balances, transaction history, services, events and settings |
| Transaction record | `ReceiptLayout.tsx` | Original desktop/mobile receipt; now wrapped with same session/MFA guard as dashboard; actual record fetched from owner-scoped API |
| Provider return | `FundingReturn.tsx` | Remains public and informational; never treats provider query parameters as proof of payment |

`apps/customer-ui/src/App.tsx` retains the same declared route inventory and preserves historical source, without routing fake success or unfinished services as active customer capabilities.

## Verified source-level corrections

1. **Shared session boundary:** New `AuthenticatedCustomerRoute.tsx` is used by the dashboard and standalone `/receipt`. It waits for session restoration, redirects anonymous visitors to login, and redirects sessions needing MFA to the authenticator challenge. It introduces no localStorage identity or new authorization policy.
2. **MFA route entry:** New `MfaChallengeRoute.tsx` requires a pending authenticated MFA challenge; `/auth/login` and `/auth/signup` redirect signed-in customers needing MFA to the challenge instead of performing a dashboard bounce. Server still authenticates requests and verifies MFA.
3. **Deferred service aliases:** `routePath.ts` normalizes case, URL-encoded path segments and trailing separators before matching deferred/excluded prefixes; malformed or traversal-like URLs fail closed. This does not replace backend feature gates or server RBAC.
4. **Internal transfers:** Original `/dashboard/transfer-funds` source stays available for future Phase 4 internal wallet-to-wallet implementation, but the route and quick-action link are inactive. No bank payout has been relabelled as an internal transfer.
5. **Fake-success legacy status:** `/dashboard/status` redirects to authenticated transaction history; the old hardcoded success/recipient/amount component remains unmounted for historical reference, not shown as a payment outcome.
6. **Sidebar navigation:** Navigation link and expand/collapse action are now separate, keyboard-operable controls. Nested routes automatically expose the active submenu; collapsed links are removed from keyboard tab order; selected links expose `aria-current`.
7. **Customer deployment:** `@twipay/customer-ui` stays the intended Vite app; `/index.html` rewrite, main root and original typography/assets remain. `apps/web` is not promoted as the customer entrypoint.

## Changes deliberately NOT made

- No global styles, colour changes, font changes, mobile dashboard header redesign or page replacement.
- No change to provider callbacks, financial authorization, NestJS routes, wallet holds, KYC, database migrations, secrets or feature toggles.
- No Google OIDC, server transaction PIN, password reset, phone verification, wallet-to-wallet transfer or organizer UI activation. Their planned phases remain 3–5.
- No claim that the ErhaPay visual experience is pixel-identical after these small navigation changes; screenshots must be compared at the approved viewports.

## Required release verification

- Run all isolated source suites and scanner checks; record their exact results and current Git HEAD.
- With Node 24, full workspace lockfile, installed dependencies and isolated PostgreSQL/Redis: build Vite, start API/worker/admin, execute `tests/e2e/customer-ui/phase2-route-boundaries.spec.ts`, exercise login/MFA/receipt in a real session, assert anonymous redirects and verify no API data leakage.
- Compare screenshots from original ErhaPay and updated TwiPay across approved responsive viewports; validate mobile drawer and keyboard submenu on real browsers.
- Re-run Phase 1.3–1.6 qualification gates before closing Phase 1. Production finance, ticketing and virtual-account capabilities stay disabled until proven.
