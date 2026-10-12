# Phase 2 / Batch 2.6 — ErhaPay visual regression and customer experience qualification

**Authority:** original `erhapay-source(2).zip` design/layout/components/fonts/assets versus `apps/customer-ui` of the consolidated TwiPay master. The simplified `apps/web` is **not** the release design authority.

## Verified in this checkpoint

- Source-level design-contract review across original/current login: identical two-column desktop layout, hidden left panel on mobile, left mockup asset, Aeonik typography, original logo, same form content width and input/button components. Customer copy intentionally changed (original `Log in` / `Welcome back! Please enter your details.`; current `Welcome back` / `Jump right back in and pick up where you left off.`). Retaining the original logo is deliberate and temporary.
- Two decorative auth mockup images given `alt="" aria-hidden="true"`. This changes no displayed copy, styles, authentication or API behaviour.
- `scripts/design/capture-erhapay-public-reference.mjs` now insists on two **different, loopback-only, independently running applications**, rejects external resources, skips service workers, checks public routes and rendered auth form controls, requires non-empty React roots, records browser errors, screenshot metadata and horizontal overflow, and **never automatically approves visual parity**.
- Eight viewports: 1440×900, 1100×800, 1024×768, 768×1024, 390×844, 360×780, 844×390, 780×360. Captures public home, about, login and signup (not financial or authenticated data).
- Added real-browser Playwright assertions for public login appearance, accessible form controls, keyboard focus, no horizontal scrolling and no browser exceptions. **Written; not executed against real React/Vite**.
- Separate local source-derived static HTML browser previews with original imagery and source-extracted copy were created for editorial discussion. They are **not running-app screenshots** and **not regression evidence**; preview artifacts are outside Git.
- The original `Dashboard_Mockup.png` itself contains *sample* financial balances and deferred product names (e.g. travel or affiliate). It is part of the preserved original design, **not a TwiPay account statement**. It should be reviewed for public marketing use before launch; do not silently alter original assets.

## Reproducible browser capture once the developer has Node 24 and a complete lockfile

1. Start the unmodified original ErhaPay Vite application on local `http://127.0.0.1:4101/` from a separate source snapshot, without real accounts, remote APIs, or provider secrets.
2. Start the **actual** TwiPay `apps/customer-ui` Vite application on local `http://127.0.0.1:4102/` with financial flags off. Use independent Node processes and clean builds. Do not use the simplified `apps/web`.
3. Run:

   ```bash
   ERHAPAY_REFERENCE_URL=http://127.0.0.1:4101/ \\
   TWIPAY_CUSTOMER_URL=http://127.0.0.1:4102/ \\
   node scripts/design/capture-erhapay-public-reference.mjs
   ```

4. Inspect `docs/tests/screenshots/phase2-reference/MANIFEST.json` and the 64 untracked screenshots; review intentional text differences and pixel/layout changes manually. Compare alignment, breakpoints, clipping, typography, loaded fonts, logos and navigation.
5. Run `APP_URL=http://127.0.0.1:4102/ pnpm exec playwright test tests/e2e/customer-ui/phase2-visual-a11y.spec.ts` with browser dependencies installed.
6. Review and approve only actual evidence. Do not commit client account data, screenshots containing real customer information or production credentials.

## Mandatory non-approval gates

- Combined frozen install and full builds (Node 24, pnpm 12.9.1) are still blocked in this session; registry DNS not reachable.
- Actual original/TwiPay React browser screenshot parity: **NOT EXECUTED**; source-derived static previews are explicitly **NOT** sufficient.
- Authenticated dashboard, mobile navigation, event and settings visual regression require an isolated running API, seeded synthetic accounts and MFA; no client wallet balances, tickets or provider status may be fabricated.
- Keyboard/screenreader/manual accessibility and real a11y browser audit: **NOT EXECUTED**.
- PostgreSQL/Redis, live auth, payments/provider sandboxes and Phase 1 runtime gates remain unqualified.
- Release status: **SOURCE-TESTED CHECKPOINT ONLY**. Production and payment activation remain disabled.

## Executed source-level checkpoint results

- Batch A–F isolated regression: **104/104 pass**.
- Phase 1 isolated regression: **43/43 pass**, with the required Node TypeScript-stripping option.
- Phase 2 design/inventory regression: **58/58 pass**, including 8 newly added Batch 2.6 source tests.
- Combined isolated tests: **205/205 pass**, no skipped or failed tests.
- Syntax, repository security, architecture, financial, services/events, product/operations, production-hardening, original visual asset inventory and Git-history secret scans: **PASS**.
- Chromium successfully rendered two **static source-derived** login comparison previews at 1440×900 and 390×844 outside Git; these are not live React screenshots.
