# Screenshots

One dated folder per review run: `docs/screenshots/<YYYY-MM-DD>-<topic>/`. Reference screenshots from
[docs/guide](../guide/README.md) and [docs/issues](../issues/README.md) by relative path; never overwrite an old run
(add a new folder), so issues keep pointing at the evidence they were filed with.

| Folder | What it shows | Produced by |
| :--- | :--- | :--- |
| `2026-10-13-auth-review/` | 13 shots of sign-up validation, verification, dashboard, login errors, rate limit, reset, admin login, dev inbox | `scripts/review-harness/journey-customer-auth.mjs` and manual steps |
| `2026-10-13-customer-routes/` | Full-page shot of every customer route as a fresh verified user, plus `ROUTES.md` (landing URL, console/API problems) | `scripts/review-harness/capture-routes.mjs` |
| `2026-10-16-admin-ops-portal/` | 10 shots of redesigned Royal Blue Operations Portal: collapsible navigation, pinned footer, dual-control Maker-Checker, circuits, and modal popups suite | Chrome headless canvas extraction & Next.js verification |

Conventions: PNG, 1280x900 viewport, name `NN-what-is-shown.png`. Use throwaway `@example.test` accounts only; never
capture real credentials, cookies or tokens.

`/guide` page: screenshots listed in `apps/customer-ui/src/routes/external-pages/guideData.ts` are copied into the git-ignored
`apps/customer-ui/public/guide/` at dev start / build when `VITE_TWIPAY_DEV_GUIDE=true`. `docs/screenshots/` is the only committed copy.
