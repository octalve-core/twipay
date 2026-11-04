# Product walkthrough: findings from recon (P1)

Source: soft recon run 18 of `tests/walkthrough/product.walkthrough.ts` on the isolated stack (`twipay-wt`, database
`wip_twipay_walkthrough`), 153 steps from an empty database. Evidence is the run's `timeline.json`, `observations.json` and
`screenshots/sNNN.png` (git-ignored under `out/walkthrough/recon-run-18/`). Step ids below (`sNNN`) refer to that run.
This is a recon list. Nothing here is fixed yet, and the strict run (P3) re-confirms each item before it is published.

IDs use `WT-NN` so they do not clash with `ISS-001..023` in [README.md](README.md).
Severity: S1 blocks a core journey or leaks data, S2 wrong behaviour with a workaround, S3 polish.

## Product defects (candidates for P2)

| ID | Sev | Area | Finding | Evidence | Proposed handling |
| :-- | :-- | :--- | :--- | :--- | :--- |
| WT-01 | S2 | admin | The UUID inputs on Financial Tiers (two) and Customer Master use `pattern="[0-9a-fA-F-]{36}"`. Browsers compile patterns with the `v` flag, where that class is a syntax error, so the browser logs "not a valid regular expression" and the check silently never runs. | s118, s149; `apps/admin/app/financial-tiers/page.tsx:118,163`, `apps/admin/app/owner/customers/page.tsx:199` | Fix: escape the hyphen (`[0-9a-fA-F\-]{36}`). Regression test. |
| WT-02 | S2 | admin | Google Fonts `@import` in `styles.css` is blocked by the admin's own CSP (`font-src 'self'`, nonce-only `style-src`), so about 62 font requests fail and the intended fonts never load. It is also an external call from a finance console. | 62 `requestfailed` and 61 CSP console errors; `apps/admin/app/styles.css:6`, `apps/admin/proxy.ts:17-19` | Self-host the two fonts, or drop the import. Owner choice, see decisions. |
| WT-03 | S2 | admin | About 98 "Applying inline style violates the Content Security Policy" errors. Inline `style` attributes are blocked by the nonce-only `style-src`, so some layout is silently not applied. | 98 console errors across admin pages | Find the inline styles and move them to classes. Needs a look before a fix. |
| WT-04 | S3 | admin | The sidebar always shows a green "ACTIVE" pill and the text "2 Owners Enrolled" whatever the real quorum is; the numbers are literals in the source. | `apps/admin/app/_components/ops-shell.tsx:209-214` | Show real counts or remove the widget. |
| WT-05 | S3 | customer-ui | Typo "Entire the details below…" on Add funds and Withdraw funds. | `add-funds/EnterAmount.tsx:37`, `withdraw-funds/RecipientDetails.tsx:18`, s015, s016 | Fix to "Enter". Regression test. |
| WT-06 | S2 | customer-ui | The avatar in the header and sidebar is a broken image on every signed-in page, and the user handle under the name shows a bare "@". | `checks.brokenImages = 2` on 60+ steps, s014 | Find the source. Fall back to initials and hide an empty handle. |
| WT-07 | S2 | customer-ui | Brand mismatch. The logo image reads "erhapay" while the page copy says TwiPay ("access more of your TwiPay account", consent text). | s014, s048 | Product decision: which brand, then replace the logo asset. |
| WT-08 | S2 | admin | Raw machine codes are shown to staff as the error text: `MFA_STEP_UP_REQUIRED` (s090, s091, s130), `FINANCIAL_TIER_REVIEW_NOT_QUALIFIED` (s103), `INDEPENDENT_OWNER_CHECKER_REQUIRED` (s122), and the status codes `WAITING_SUPPORT` (s113) and `WAITING_CUSTOMER` (s143). | `checks.rawCodes` in `timeline.json` | Map codes to sentences. |
| WT-09 | S2 | admin | `GET /v1/operations/financial-eligibility/reviews` returns 503 when Exceptions & Holds is opened as an owner. | s102 | Investigate the cause (provider switch off, or a real fault). |
| WT-10 | S3 | admin | The admin requests data the signed-in role is not allowed to read, then 403s: owner pages fire `owner/overview` and `owner/risk` before MFA step-up (7 times each), FINANCE_APPROVER requests `financial-eligibility/reviews` (s134), OPERATIONS requests `notifications/delivery-summary` (s138), SUPPORT_AGENT requests `disputes` and `support/cases` (s130). The pages cope, but each is a console error and a log line. | s095-s151 | Gate the requests on role and step-up. |
| WT-11 | S3 | customer-ui | The public FAQ page shows no questions ("No FAQs available"). The page waits for a backend list that returns nothing. | s005, `components/external-pages/faq/Faqs.tsx` | Product decision: seed content or hide the page. |
| WT-12 | S3 | customer-ui | Contact form cannot send (the page says so); the email field has no label. | s003 | Product decision, plus label fix. |

## Accessibility (axe-core, per screen, in the step log)

Counts are nodes across the whole soft run.

| ID | Impact | Rule | Nodes / pages | Notes |
| :-- | :-- | :--- | :--- | :--- |
| WT-13 | critical | image-alt | 177 / 31 | Images with no alt text (marketing pages and the app). |
| WT-14 | critical | button-name | 63 / 26 | Icon-only buttons with no accessible name. |
| WT-15 | critical | label | 1 / 1 | Contact form email field. |
| WT-16 | serious | color-contrast | 572 / 45 | Muted grey text and disabled buttons. Largest group. |
| WT-17 | serious | link-name | 26 / 6 | Links with no text. |
| WT-18 | serious | label-content-name-mismatch | 64 / 20 | Accessible name does not contain the visible text. |
| WT-19 | serious | aria-dialog-name | 21 / 1 | History's Filter drawer has no accessible name (seen in run 17, to re-confirm). |
| WT-20 | moderate | heading-order, page-has-heading-one, landmark-unique | 18 / 21 / 6 | Structure. |
| WT-21 | minor | image-redundant-alt, empty-table-header | 15 / 2 | |

Proposal: fix the cheap structural ones (alt text, button names, dialog name, heading one) in P2 and list contrast as a design task.

## Observed and fine (not defects)

- The unauthenticated landing page logs two 401s (`/auth/me`, `/auth/mfa/status`): already ISS-012.
- A wrong email code returns 403 (s010), a wrong password returns 401 (s063, s089), a suspended account is refused at login (s153), and an owner approving their own proposal is refused (s121). All as designed, and each is a step in the run.
- Bill payments and bank transfers are paused in this stack and the pages say so. Their buttons are disabled on purpose (Proceed, Verify identity before consent, Mark all as read at 0 unread). Run 18's seven failed steps were the harness trying to click these. The chapter now asserts the disabled state instead, but that change has not been run yet.
- Next.js prefetch requests show as `ERR_ABORTED` when a page navigates away. Noise.

## Not demonstrable here

Recorded in `tests/walkthrough/matrix/rows.json` as `not-demonstrable`, with the reason for each: anything that needs a live payment, bank, KYC or SMS/email provider (Add funds completion, withdrawals, bill purchase, identity result, real email delivery), and the deferred features the product hides on purpose.

## Operator bootstrap (the one allowed direct database write)

The first two owners and the staff roles needing a pre-existing owner are written by `lib/stage.ts` (`bootstrapOwners`, `bootstrapRoles`). Both refuse any address that is not `@twipay.example` and any database other than `wip_twipay_walkthrough`. Everything else in the journey is done through the UI.

## P2 status (2026-11-05)

Fixes are on two branches off `master`, each with regression tests that fail on the old code. Nothing is merged. Strict re-confirmation
happens in P3.

| ID | Status | Where |
| :-- | :-- | :-- |
| WT-01 | Fixed | `fix/wt-admin-quality` (4 UUID fields, incl. owner/staff, which the run did not reach) |
| WT-02 | Fixed (fonts now served from the admin's own origin through `next/font`, fetched at build time) | `fix/wt-admin-quality` |
| WT-03 | Partly fixed: the spinner `<style>` moved to the stylesheet. The rest is the CSP blocking inline `style=""` attributes, which visibly breaks parts of the sign-in page. Needs an owner decision, see below. | `fix/wt-admin-quality` |
| WT-04 | Fixed: the fixed "ACTIVE" pill, "2 Owners Enrolled" and the nav badges (3, 4, 2, 99.8%, 6) are removed. Found in P2: the badges were also invented. | `fix/wt-admin-quality` |
| WT-05 | Fixed | `fix/wt-customer-ui` |
| WT-06 | Fixed: initials, hidden empty handle. The sidebar's always-on "verified" tick is removed with it. | `fix/wt-customer-ui` |
| WT-07 | Open: brand decision | |
| WT-08 | Fixed: `explainCode` / `statusLabel` at all call sites, and the failure card no longer says "Error Code:" | `fix/wt-admin-quality` |
| WT-09 | Not a defect: the endpoint is gated by `FINANCIAL_TIER_REVIEW_SANDBOX_ENABLED` and answers 503 `FINANCIAL_TIER_REVIEW_NOT_QUALIFIED` by design. The page now says so in words. Recorded as "not demonstrable here". | |
| WT-10 | Open: gate requests on role / step-up (S3, not started) | |
| WT-11, WT-12 | Open: product decision | |
| WT-13 | Fixed (93 images) | `fix/wt-customer-ui` |
| WT-14 | Partly fixed: the log-out button. Other unnamed buttons will show up in the next run's axe output. | `fix/wt-customer-ui` |
| WT-15 | Fixed (contact form) | `fix/wt-customer-ui` |
| WT-16 | Open: design task | |
| WT-17, WT-18, WT-21 | Open | |
| WT-19 | Fixed | `fix/wt-customer-ui` |
| WT-20 | Partly fixed: h1 on the auth screens; the 404 page and admin pages not yet. | `fix/wt-customer-ui` |

New in P2, not in the table above: the admin sign-in page footer described the console's security internals ("SHA-256 Nonce CSP", "HttpOnly"); replaced with plain wording.
