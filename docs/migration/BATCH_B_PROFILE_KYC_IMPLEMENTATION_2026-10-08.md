# TwiPay — Continued Batch B profile/KYC implementation

**Classification:** SOURCE INTEGRATION CHECKPOINT; NOT BROWSER OR PROVIDER QUALIFIED.
**Authority:** ErhaPay's original React UI is the customer-facing visual baseline. No visual redesign. Betting permanently excluded. Other deferred features remain in source but inactive.

## Verified source contracts used

- `apps/api/src/modules/auth/presentation/auth.controller.ts`: `PATCH /v1/auth/me` accepts only optional nullable `givenName` / `familyName` (each nonempty if not null, max 100); returns `{user}`. `GET /v1/auth/me` is authoritative for session profile.
- `apps/api/src/modules/kyc/presentation/kyc.controller.ts`: `GET /v1/kyc/verifications`; `POST /v1/kyc/verifications` accepts `{type:BVN|NIN, identifier:11 digits, consent:true, scope?:identity|bank_accounts}` and requires `Idempotency-Key`; `POST /v1/kyc/verifications/:id/continue` accepts `REQUEST_OTP` + `verificationMethod` or `SUBMIT_OTP` + `otp`, also idempotency-key.
- `apps/api/src/modules/kyc/application/kyc.service.ts` uses encrypted identifiers and fingerprints, returns status and masked last four on listing; it handles provider exceptions as `PENDING` (uncertain), never as automatically verified.
- `packages/providers/identity/mono/src/index.ts` returns dynamic BVN verification methods; no guaranteed SMS method exists. The frontend uses only provider-supplied string methods; other provider method shapes are deferred for a verified adapter change.

## Completed, source reviewed

1. ErhaPay account page retains its original card, photo and form arrangement. The two name fields now use supported `PATCH /auth/me`; successful mutation invokes `refreshSession()` and handles failed session confirmation. Email, username, country, state remain rendered but read-only. No fake backend mutation. **Legacy direct ImageKit profile photo upload disabled** pending an Octalve-controlled media API.
2. Added `IdentityVerificationSettings.tsx` under ErhaPay settings, preserving its palette/layout; new route `settings/identity-verification` and settings item. Identity fields are not persisted in local/session storage and are cleared after accepted initiation. Explicit consent and correct 11-digit validation; frontend never invents verification outcome or method.
3. `kycApi.ts` maps verified controller routes, idempotency headers, OTP request/submit and history. Axios allowlist expanded narrowly to these routes; existing session cookies and CSRF enforcement remain.
4. Preserve MFA work from earlier Batch B checkpoint; no backend service or financial changes made.
5. Corrected the unsubstantiated fixed `Verified` badge on the account settings item (identity verification has its own history/status).
6. Added `docs/migration/test/batch-b-profile-kyc.test.mjs` for cross-layer contract checks and `playwright.customer-ui.config.ts` + `tests/e2e/customer-ui/auth-profile-kyc.spec.ts` for genuine runtime tests on developer's sandbox.

## Security and function limits (not silently solved)

- KYC tests intentionally do not initiate live BVN/NIN provider charges. Use only sanctioned sandbox identities/provider credentials with explicit separate approval.
- The current backend does not persist/expose dynamic provider verification methods in the GET history response; resuming certain in-flight BVN challenges after reload is **not fully supported**. Do not invent a hardcoded OTP method. Handle with a subsequent verified backend contract design.
- Unsupported avatar, username, country, state, password reset/change and bank accounts remain visually preserved but inactive; they require reviewed API contracts.
- Backend `@twipay/provider-mono` uses NIN and BVN endpoints; true Mono availability/configuration/response shapes must be sandbox verified.
- All identity OTP/identifier handling uses in-memory component state only. Network/service errors are not interpreted as success. Accepted but uncertain outcomes instruct checking recorded verification history.
- No frontend browser `localStorage`/`sessionStorage` identity secret persistence added.
- Unresolved latest developer GitHub merge: `git ls-remote https://github.com/octalve-core/twipay.git HEAD` fails DNS resolution in this environment; ADRs 016–018 and the latest build fixes are **not** incorporated.
- Node is v22 rather than approved 24; dependencies not installed. Local Next.js/Vite/API/Postgres/Redis on 3000/5173/4000/5435/6382 unavailable, so genuine build, Playwright auth/MFA, KYC/provider and responsive visual tests **BLOCKED**. Do not promote candidate as production ready.

## Runtime qualification to run only on isolated developer machine

1. Merge **actual latest GitHub checkout** with this preserved ErhaPay candidate via three-way Git comparison; do not blindly overwrite.
2. Install pinned Node 24 and pnpm 12.9.1 (per older manifest; confirm latest git), `pnpm install --frozen-lockfile` only if latest real lockfile matches.
3. Start developer's PostgreSQL18/Redis8, apply audited migrations, run API/worker and ErhaPay Vite customer UI (normally localhost:5173). Set API `APP_URL` to exact same Vite origin and `ADMIN_URL` appropriately; use local secure-cookie and exact-origin config, never wildcard CORS.
4. Set test-only `TWIPAY_CUSTOMER_UI_URL`, `TWIPAY_TEST_CUSTOMER_EMAIL`, `TWIPAY_TEST_CUSTOMER_PASSWORD`. For the MFA case optionally add `TWIPAY_TEST_MFA_EMAIL`, `TWIPAY_TEST_MFA_PASSWORD`, `TWIPAY_TEST_MFA_CODE` for an enabled sandbox account. NEVER commit these environment values.
5. Run `pnpm exec playwright test --config=playwright.customer-ui.config.ts`; inspect trace, browser console, response errors, session cookie/CSRF, mutation permissions, actual MFA, and compare original ErhaPay screenshot layouts.
6. Independently qualify KYC provider responses, consent/legal basis, failure requery, rate-limits, cost controls and continuation UX before enabling production KYC.

## Report status vocabulary

**PASS** source-level tests and syntax scanners; **BLOCKED** actual latest developer Git merge, dependency/full build, browser cookies/MFA and provider/DB tests. No UNKNOWN reported as success.
