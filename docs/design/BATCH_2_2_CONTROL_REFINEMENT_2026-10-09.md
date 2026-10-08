# TwiPay Phase 2 / Batch 2.2 — ErhaPay Control Consistency and Accessibility

Date: 2026-10-09. Initial source checkpoint: `cbb698d0d1e5799f37be40f386e9994d8815b9a1`.

## Scope and boundaries

This is a targeted source-level control audit within the **same Git-backed master** and original ErhaPay-derived `apps/customer-ui`. It does **not** migrate pages, replace colours/fonts, activate account recovery/Google OIDC/transaction PIN, change the API/ledger, enable financial operations, or constitute browser visual approval. No original raster/SVG assets were edited. `apps/web` is still reference-only.

## Source-confirmed findings and corrections

| Component | Actual issue | Resolution / design impact |
|---|---|---|
| `CustomButton` | When `href` was used, `disabled` and `isLoading` did not stop navigation. Native buttons relied on callers to combine loading with disabled. Keyboard focus had no explicit product focus style. | Preserve legacy colour and `variant="secondary"` mapping; block disabled/loading links, expose `aria-disabled` and `aria-busy`, remove disabled link from keyboard tab order, disable native button when loading and add focus-visible outline. **Do not change legacy default `type="submit"`**: some existing forms depend on it. New non-submit actions must pass `type="button"` explicitly. |
| `BackButton` | Icon-only actions lacked names, link-shaped disabled Back could still navigate, and action buttons defaulted to submit inside forms. | Name icon Back, use decorative `alt=""`, explicit `type="button"`, prevent disabled-link navigation and mark disabled state. |
| Dashboard mobile sheet | Menu trigger manually reset open state and had no accessible label; Radix sheet lacked an accessible title/description. | Remove competing trigger state change; add descriptive open/close labels and visually hidden sheet title/description. Retain original drawer direction and sidebar. |
| Public mobile sheet | Unnamed menu buttons, no dialog title, fixed `100vw/100vh` menu content on short viewports, and decorative inert App Store badges wrapped in clickable buttons with no effect. | Label controls and Radix sheet, make panel content scrollable within dynamic viewport, remove false clickable badge semantics while preserving visual assets. **Exact visual screenshot comparison is still required.** |
| Login and sign-up | Inline field errors were not programmatically associated with inputs; password reveal buttons lacked accessible names. | `aria-invalid`, `aria-describedby`, stable error IDs, `role="alert"`, explicit show/hide names, preserved field styling; sign-up name/email/new-password autocomplete. |
| Login unavailable controls | "Remember for 30 days" checkbox had no server-side implementation, and "Forgot password?" linked to an inactive guarded screen. | Disable remember-device checkbox with accessible explanation; identify password recovery as unavailable instead of navigating back to login. Full recovery and session remembrance belong to Phase 3. |
| Dashboard profile | Original header/account settings showed a verification check regardless of a server-verified status. The current `AuthContext` does not yet populate authoritative verification fields. | Remove unconditional verified badges until a backend status is available. Preserve surrounding layout and original images. Phase 3 must reintroduce status-specific indicators only when server-backed. |
| Empty/success illustrations | Decorative images had no alt attributes. | Add `alt=""`; retain layout/assets and do not change success outcomes. |

**Not included:** a global CSS colour-token rewrite, new third-party UI kit, changes to the Radix dialog internals, fake verified status, bypassed auth/feature guards, or automatic submission from browser visual comparison.

## Regression and visual evidence preparation

- `docs/design/test/batch-22-controls.test.mjs`: eleven focused source-contract tests; the existing eight Batch 2.1 tests continue. The root `test:design` script and CI run the full design suite.
- `tests/e2e/customer-ui/phase2-controls-a11y.spec.ts`: three **prepared, unexecuted** Playwright tests for anonymous login/signup invalid form feedback and mobile public navigation keyboard dismissal.
- `scripts/design/capture-erhapay-public-reference.mjs`: optional local-only Playwright screenshot comparison, **not run**. It requires independent original/current localhost servers, blocks third-party requests, never fills or submits forms, and captures four anonymous paths at eight viewports in both applications. It deliberately does NOT capture protected dashboard data. Output is untracked and not approved automatically. Never point it at real customers or production services.

After the genuine Node 24/pnpm workspace build and original reference server are available, run the browser checks against a disposable local environment, compare original/current screenshots side by side, review responsive heights, keyboard focus and screen-reader semantics, and obtain design sign-off. **No image equality claim is made by this source batch.**

## Security and release boundaries

The financial server feature flags, API guards, session/CSRF and ledger services were not modified. Do not turn on money movement or ticket QR while these runtime gates are unresolved. Backend-authoritative Google OIDC and transaction PIN remain required in Phases 3–4.

Phase 1 still lacks a complete validated lockfile, real builds, database/Redis concurrency and provider tests. Source checks are separate from runtime qualification and must be reported as such.
