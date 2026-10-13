# TwiPay user guide (development build)

A walkthrough of what the running app does today, with screenshots. Keep it in step with the app: when a screen changes,
recapture it ([scripts/review-harness](../../scripts/review-harness/README.md)) and update the text. Screenshots live in
[docs/screenshots](../screenshots/README.md); the same screenshots are shown as a web page at **`/guide`** in the customer UI. That page exists only in dev builds
(`VITE_TWIPAY_DEV_GUIDE=true`, set by `compose.stack.yaml`): `apps/customer-ui/scripts/sync-guide-images.mjs` copies the files listed in
`apps/customer-ui/src/routes/external-pages/guideData.ts` from `docs/screenshots/` into the git-ignored `public/guide/`, and removes it
when the flag is off. Edit captions in `guideData.ts`; never edit `public/guide/`.

All emails in the development build arrive in the floating inbox button (bottom-right of both apps).

## 1. Create an account
Open `/auth/signup`. Names, a valid email and a password of at least 12 characters are required; errors appear under the fields.
![Sign-up errors](../screenshots/2026-10-13-auth-review/01-signup-validation-errors.png)

## 2. Verify your email
A six-digit code is sent to your email (dev inbox). A wrong code shows an error and clears the field.
![Verify email](../screenshots/2026-10-13-auth-review/02-verify-email-page.png)
![Wrong code](../screenshots/2026-10-13-auth-review/03-wrong-code-error-field-cleared.png)

## 3. Dashboard
After verification you land on the dashboard.
![Dashboard](../screenshots/2026-10-13-auth-review/04-dashboard-after-verification.png)

## 4. Sign in, and what happens when it goes wrong
![Wrong password](../screenshots/2026-10-13-auth-review/05-login-wrong-password-message.png)
![Email already registered](../screenshots/2026-10-13-auth-review/06-signup-duplicate-email-message.png)
After ten attempts in a minute you are asked to wait.
![Rate limited](../screenshots/2026-10-13-auth-review/09-login-rate-limited-message.png)

## 5. Reset a forgotten password
Enter your email, then the eight-digit code and a new password.
![Code entered](../screenshots/2026-10-13-auth-review/07b-reset-code-entered.png)
![New password](../screenshots/2026-10-13-auth-review/07c-set-new-password-step.png)
![Updated](../screenshots/2026-10-13-auth-review/08-password-updated.png)

## 6. Admin console
Staff sign in at the admin app. The owner area also needs a verified email, the `SUPER_ADMIN` role and MFA.
![Admin wrong password](../screenshots/2026-10-13-auth-review/10-admin-wrong-password.png)
![Admin after login](../screenshots/2026-10-13-auth-review/11-admin-after-login.png)

## 7. Development inbox
![Inbox](../screenshots/2026-10-13-auth-review/12-dev-inbox-panel.png)

## 8. Every customer page
Full-page captures of all customer routes: [screenshots/2026-10-13-customer-routes](../screenshots/2026-10-13-customer-routes/ROUTES.md).
TODO (next agent): one section per dashboard area (wallet, services, settings, events, cards) with descriptions of each
button and popup, and the admin pages.
