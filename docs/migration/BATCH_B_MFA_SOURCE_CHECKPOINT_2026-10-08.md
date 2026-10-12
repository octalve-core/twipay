# TwiPay — Batch B MFA source checkpoint (NOT live qualified)

Date: 2026-10-08. Source: provisional master inherited from Batch A; Git HEAD `9bbad49aa478377efcba58f105fb12ec53f4d866` plus **preserved uncommitted WIP**. The developer's newer GitHub checkout and ADRs 016–018 have **not** been read or merged (network DNS `Could not resolve host: github.com`).

## Scope and preserved appearance

The original ErhaPay `apps/customer-ui` (React/Vite) is the authoritative customer UI. Existing ErhaPay logo and all original binary assets remain unchanged. The original account-security settings row, dialog, login MFA page and six-slot OTP entry remain styled and positioned as before. These frontend-only changes do not touch financial ledger, provider, database migrations or backend controllers.

## Evidence-backed defect corrected

- Original ErhaPay `Set2FAModal` submitted `POST /auth/2fa/toggle` and `Set2FAForm` used `POST /auth/2fa/resend` and claimed that an email OTP would be delivered.
- The existing TwiPay NestJS `MfaController` provides **TOTP authenticator**, not those ErhaPay email OTP routes.
- Updated the preserved row/dialog to use `POST /v1/auth/mfa/enroll` (password re-authentication), `POST /v1/auth/mfa/enroll/confirm` (TOTP code), `POST /v1/auth/mfa/recovery-codes/regenerate`, `POST /v1/auth/mfa/disable`, and verified `GET /v1/auth/me` refresh after rotated-session mutations.
- Setup secret, authenticator URI and one-time recovery codes are transient React component state only and are not logged or stored to browser localStorage/sessionStorage; codes are presented once for secure offline saving.
- Existing login MFA page now supports one-time recovery code entry as well as the original six-slot authenticator input, matching the existing API `MfaService.verifyActiveFactor()`.
- Endpoint allowlist in the fail-closed API client was expanded **only** to the verified MFA controller routes; legacy money/services endpoints remain blocked.

## Existing security controls retained

- Session cookies are server-set opaque HttpOnly tokens. Browser mutations obtain a server CSRF token; API exact-Origin enforcement remains.
- Only the backend verifies TOTP and recovery-code hashes, manages lockouts/replay, changes credential status, rotates sessions and audits actions.
- No new backend capability, bypass, Firebase authentication, browser payment provider credential or browser-held JWT was introduced.
- Production feature flags `events.refunds=false` and `operations.organizer_payouts=false` remain untouched and off.
- Betting remains excluded. Inactive e-PIN, travel, cards, international airtime/data, eSIM, mobile money, referral and affiliate modules remain preserved but inactive.

## Actual commands and results

Environment: Linux container, Node v22.16.0, no pnpm, Node24, installed frontend node_modules, PostgreSQL, Redis or Docker; GitHub remote DNS fails.

| Command | Status | Actual result |
| --- | --- | --- |
| `node --test docs/migration/test/batch-a.test.mjs` | PASS | 15/15 source/contract tests |
| `node scripts/typescript-syntax-check.mjs` | PASS | 430 source files |
| `node scripts/repository-security-check.mjs` | PASS | 754 text files |
| `node scripts/architecture-check.mjs` | PASS | architecture invariants |
| `node scripts/financial-invariant-check.mjs` | PASS | financial static invariants |
| `node scripts/services-events-invariant-check.mjs` | PASS | service/event invariants |
| `node scripts/product-operations-invariant-check.mjs` | PASS | ops invariants |
| `node scripts/production-hardening-invariant-check.mjs` | PASS | hardening invariants |
| `node scripts/git-history-secret-check.mjs` | PASS | 348 tracked paths + reachable Git patch history |
| `git diff --check` | PASS | no whitespace errors in tracked diff; untracked source reviewed separately |
| `(cd apps/customer-ui && tsc -b --pretty false)` | BLOCKED (exit 1) | dependency graph absent: TS2307 missing react-router-dom, sonner, react, etc. The output is NOT a valid full build result. Do not ignore possible real TS issues once dependencies installed. |
| `git ls-remote https://github.com/octalve-core/twipay.git HEAD` | BLOCKED | `Could not resolve host: github.com` |
| Real Playwright frontend + API + Postgres/Redis MFA E2E | BLOCKED | no current local stack/browser/provider-enabled runtime |

## Files intentionally changed

- `apps/customer-ui/src/lib/api/authApi.ts`: typed MFA API adapter.
- `apps/customer-ui/src/lib/api/axios.ts`: verified MFA routes in fail-closed client allowlist.
- `apps/customer-ui/src/components/dashboard/settings/Set2FAForm.tsx`: real TOTP enrollment, confirm, disable, recovery-code operations.
- `apps/customer-ui/src/components/dashboard/settings/set2FAModal.tsx`: preserves original UI shell and uses the new form; no legacy toggle.
- `apps/customer-ui/src/routes/auth-pages/TwoFAOtp.tsx`: supports recovery-code challenge, retains original TOTP slots.
- `docs/migration/test/batch-a.test.mjs`: 3 extra cross-layer assertions (now 15 total).

## Limitations / next required actions

1. First get latest developer checkout (includes reported Prisma 7/Postgres fixes), verify Git HEAD/ADRs/lockfile and reconcile safely into **one master repo**. Do not replace the backend from this older provisional checkpoint.
2. On the confirmed developer environment, run genuine `pnpm install --frozen-lockfile`, customer-ui `tsc`+Vite build, API startup and real browser MFA enrollment/challenge/recovery/regeneration/disable against PostgreSQL, including HttpOnly cookie, CSRF, malicious Origin, replay and race-condition tests. Correct any genuine TS/runtime errors.
3. Complete Batch B profile `PATCH /v1/auth/me`, KYC `POST/GET /v1/kyc/verifications`, OTP continuation, and other account paths **only against verified controllers**. Existing old profile/country/phone/email-reset functions fail closed; do not pretend supported.
4. Secure otpauth URI and recovery-code display must be tested for password manager/copy/screen-reader/responsive UX; avoid using online QR generators that would leak secret material.
5. This is a **source checkpoint, not a production-qualified release**, and should not be separately shipped as a final ZIP to the user. Continue in one maintained monorepo.
