# TwiPay Phase 2.1 — ErhaPay Design Inventory & Reuse Contract

**Date:** 2026-10-09. **Basis:** `apps/customer-ui` source at Phase 1.6 Git `5434bc93e8964f1c65a14e074592b3d709b4c33b`, cross-checked with the user-provided original `erhapay-source(2).zip`. **Scope:** source-only design inventory, additive component scaffolds, asset-content integrity. No existing route has been rewritten, and no money movement, authentication, or feature flag has been enabled.

## 1. Visual authority and source boundaries

- **Authoritative customer UI:** React/Vite implementation at `apps/customer-ui` derived from original ErhaPay. `apps/web` (simplified Next.js) is historical reference, **not** the design source or production customer UI.
- **Global font:** `Aeonik` via three font-face weights in `src/index.css` (normal, 500, bold). Do not replace fonts in new pages or distribute the font files independently.
- **Primary ink/brand:** `#112929` from `src/index.css` `--color-primary` and repeated original components. Other strongly recurring text neutrals include `#344054`, `#667085`, `#475467`, `#727884` and `#717171`. White cards and `#F9FAFB` canvas are present in existing screens; borders often use `#D0D5DD` / `#F0F2F5`.
- **Layout:** marketing `MainLayout` (Navbar, Footer), authentication `AuthLayout`, logged-in `DashboardLayout` (sidebar + header), receipt `ReceiptLayout`. These four layouts must be reused, not replicated.
- **Dashboard:** max width `1440px`, desktop sidebar `272px`, header `70px`, scrollable light canvas `#F9FAFB` and spacing `px-5 md:px-8` from `DashboardLayout`. Marketing `.container` uses max width `1180px` in `index.css`.
- **Responsive:** existing source uses `md:` and `max-md:` heavily; compact screens have mobile navigation, alternate header/back controls, horizontal cards, and distinct receipt presentation. Do not build desktop-only new pages.
- **Buttons:** **ErhaPay `components/CustomButton.tsx`** is the first choice for product actions: primary filled appearance is the component's default `variant="secondary"`, while `variant="primary"` renders its original pale variant. `components/ui/button.tsx` is a separate Radix/shadcn primitive; do not swap it into existing views to "standardize" appearance without screenshots.
- **Forms:** existing product flows use clear text labels, white field surfaces, border `#D0D5DD`, `rounded-lg`, and deep-green focus borders. New fields should reuse the nearest existing pattern; do not introduce new colours or ambiguous status labels.
- **Reusable primitives:** existing `BackButton`, `EmptyState`, `CustomButton`, `DashboardHeader`, `Sidebar`, existing Radix dialog/alert/table/select/OTP primitives, and the **additive** `design-system/ErhaPagePrimitives.tsx` for future new customer pages.

## 2. Machine-generated inventory

`node scripts/design/erhapay-ui-inventory.mjs --check` validates current source against `docs/design/ERHAPAY_COMPONENT_INVENTORY.json`, and compares original image/icon content with the frozen baseline `docs/design/ERHAPAY_ORIGINAL_VISUAL_ASSETS.json`. After an **approved** change to customer UI, regenerate the component inventory with `--write`, review the diff, and preserve the baseline hash manifest.

At this checkpoint the inventory finds **59 declared `path:` entries** in the React router (including protected/deferred routes, not 59 available product features), **four** layout components, **eight** auth-page modules, **19** dashboard route files, **15** generic UI primitive modules, and **15** dashboard domain component directories. Colours and responsive breakpoints are counted as literal CSS/JSX references, not as a newly ratified colour-token system. Exact counts are in the JSON registry.

### Original asset-content correction

The original ErhaPay ZIP contains **123 image/icon files** (`.svg`, `.png`, `.jpg` and related raster/icon formats). All 123 are present with **no content changes** beyond line endings: **69 byte-for-byte equal; 54 SVGs differ by CRLF-to-LF normalization only**. This explicitly corrects previous broad claims that all visual assets were byte-identical. `.gitattributes` enforces LF for text. Font files are not part of the 123-image set. Actual browser renders and screenshots are **not** verified.

## 3. Existing components to reuse, by future screen

| Desired screen | Existing ErhaPay reuse path | Dedicated backend/domain qualification |
|---|---|---|
| Settings, account security, sessions | `SettingsPage`, `SecuritySettings`, `AccountSettings`, `BackButton`, `CustomButton` | Phase 3: KYC, password reset, email/phone verification, Google OIDC, MFA, **mandatory server-side transaction PIN** |
| Saved beneficiaries, fee quote, internal transfers | `WithdrawFunds`, `TransferFunds`, product forms, `CustomButton`, dashboard header | Phase 4: atomic money movement, policy/fees, backend PIN + MFA, recipient authorization |
| Transaction status & receipts | `History`, `TxnHistoryDetail`, `receipt/{DesktopReceipt,MobileReceipt}`, `EmptyState` | Phase 4: real server states; no client-assumed success |
| Organizer dashboard, events editor | `DashboardLayout`, `DashboardHeader`, `Sidebar`, `Events` cards and settings panels | Phase 5: organizers, permissions, ticket quotes, capacity controls |
| Purchased tickets & secure QR | Existing event cards and receipt-style presentation | Phase 5: owner-only credential retrieval, QR display, safe check-in, anti-replay |
| Notification centre | Existing `notifications/`, dashboard bell, `EmptyState` | Phase 5: read/unread persistence, preferences, actual delivery state |
| Support centre, financial cases | Existing Settings/Support, alert/dialog/ui primitives | Phase 5: general support tickets, owner-scoped case messages, financial dispute isolation |
| Admin-specific actions | **Separate** `apps/admin`, not ErhaPay customer navigation | Phase 5: RBAC and maker/checker backend; Phase 6 role browser tests |

New ErhaPay pages should use `ErhaPageFrame`, `ErhaPageHeading`, `ErhaSettingsPanel` only where the existing Settings-style composition fits. These are **additive, unmounted** components; they do not create new account workflows or bypass route guards. The original marketing, authentication, dashboard and receipt pages remain unchanged.

## 4. UI consistency and security findings (for later batches)

1. **Two button families coexist:** `CustomButton` and `components/ui/button`. Their variant/default designs are not identical. New customer flows should follow the local product component, not assume the shadcn variant is identical.
2. **Numerous literal colours:** no single complete semantic token map currently covers the ~94 distinct hex literals in source. The goal is visually consistent reuse, **not** a blind search/replace that might recolour error, success, partner or icon assets. Colour-token extraction belongs in Batch 2.2 only after pixel baseline evidence.
3. **Potential accessibility issues:** examples include a profile avatar image in `DashboardHeader` with no `alt`, some image-icon-only actions, and an empty-state illustration without `alt`. Batch 2.2 should review and fix verified issues in context, using real browser/accessibility tests.
4. **Button navigation semantics:** `CustomButton` `href` uses a `<Link>`; disabled/loading link cases need review before reuse in sensitive operations. Do not turn a visually disabled link into an enabled mutation.
5. **Default submit semantics:** `CustomButton` defaults to `type="submit"`. On future confirmation screens, pass `type="button"` for non-submit actions, and ensure double-submission protection is server-enforced.
6. **Existing route modules are not promises of availability:** original reset password, Google login, transaction PIN, some services/travel/card/referral pages are preserved but inactive until their secure backend contracts are qualified. Do not remove guards to make a page visible.
7. **Success-message animation:** `SuccessMessage` auto-navigates after a delay; do not show a success state on a financial or ticketing operation until the backend confirms a terminal success status.
8. **Layout screenshot parity:** even with exact code or icons, fonts, CSS, mobile safe areas and browser rendering may differ. Need read-only Playwright screenshots across eight viewports and accepted visual comparison in Phase 2.6/6.4.
9. **Original logo:** original ErhaPay logo is temporarily preserved as agreed; changing logos requires an explicit branding checkpoint, not an opportunistic UI refactor.

## 5. Mandatory rules for new TwiPay customer UI

- Reuse `DashboardLayout`, `BackButton`, `CustomButton`, status/empty states, dialogs and lists where applicable.
- Maintain original Aeonik typography, existing visible colour and spacing patterns. No independent component library or import of simplified `apps/web` layouts.
- Page state must distinguish loading, empty, error, pending/unknown, and final results; never fabricate wallets, fees, tickets or provider verification.
- Forms use semantic labels, keyboard focus states and accessible feedback. Missing APIs remain visibly disabled, not simulated.
- Financial action approval needs backend authorization, session, CSRF, transaction PIN and MFA where applicable; UI components alone are not safeguards.
- Never enable betting; deferred e-PIN, travel, card, eSIM, international data/mobile money and affiliate flows stay inactive.
- Introduce frontend changes in small, reviewable commits with screenshots once browser environment is qualified.

## 6. Exit assessment

**Phase 2.1 source-inventory checkpoint:** source/asset inventory and additive page primitives pass the eight focused local tests; the original Batch A–F and Phase 1 suites also pass after the clean-checkout SVG LF test correction.

**Not yet qualified:** CSS/React build under Node 24, pixel visual comparison, viewport navigation, real accessibility audit, authenticated UI against API, and Phase 1 PostgreSQL/Redis security gates. These remain explicitly BLOCKED until executed. This is **not** Phase 1 sign-off or Phase 2 visual approval.

## 7. Phase 2.2 follow-up — minimal control refinement (2026-10-09)

Batch 2.2 addresses specific keyboard and disabled-state defects **inside existing ErhaPay components**, not new screen designs. `CustomButton` keeps its original appearance and default submit behaviour; disabled/loading links now fail closed and loading native buttons are disabled. `BackButton` has accessible names and safe button semantics. Mobile sheets receive proper screen-reader titles and scroll handling. Login/signup errors have explicit field associations; unavailable remember-me/password-reset controls are no longer falsely actionable. Unconditional profile verification marks are removed until the API can attest to status. Original icon/raster asset content is unchanged. See `docs/design/BATCH_2_2_CONTROL_REFINEMENT_2026-10-09.md` for the exact change and qualification matrix.

Screenshot and real accessibility evidence still require a working browser and the isolated original reference build. This source review must not be mistaken for browser or release approval.
