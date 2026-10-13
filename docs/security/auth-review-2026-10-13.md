# Authentication review — 2026-10-13

Scope: customer registration, email verification, login, logout, password reset and rate limiting, exercised in a real
browser against the production builds and directly against the API. Source of record for what was fixed:
[tasks/prev_tasks_04.md](../tasks/prev_tasks_04.md) (Task 04.7). This note lists what was **verified working** and what
remains **open**. It is an engineering review, not a penetration test or a compliance assessment.

## Verified working
- Registration validates names, email and password length in the UI and on the API (`strict` schemas reject extra fields,
  so `role: SUPER_ADMIN` is refused with 400).
- Email verification with a six-digit code; wrong codes are rejected and counted (5 attempts per challenge).
- Login: wrong password and unknown email return the same `401 INVALID_CREDENTIALS`; email matching is case-insensitive.
- Logout revokes the session on the server (replaying the old cookie returns 401) and clears both cookies.
- Route guards: `/dashboard` redirects to login when signed out; `/auth/login` and `/auth/signup` redirect when signed in.
- Password reset: code by email, new password works, old password is rejected, a "your password was reset" notice is sent.
- Browser requests need an allowed `Origin` (403 otherwise); unsafe requests need the CSRF header (401 `CSRF_REQUIRED`).
- Login/registration share one bucket of 10 requests per minute per IP; further requests get `429 RATE_LIMITED`
  with `Retry-After`, and clients that keep going are banned for the window.

## Open findings

| # | Finding | Impact | Suggested direction |
| :-- | :--- | :--- | :--- |
| 1 | Password policy is length only (12–128). `aaaaaaaaaaaa`, `123456789012`, `password1234` are accepted. The reset screen shows an "uppercase" rule the server does not enforce, while sign-up shows none. | Weak passwords; inconsistent UI | Deny-list of common/breached passwords and a rule against the email local part; make UI and server rules identical (`packages/security` `validatePasswordPolicy`) |
| 2 | Registration answers `409 ACCOUNT_ALREADY_EXISTS`, revealing registered emails, whereas password reset is deliberately non-enumerating | Account enumeration | Product decision: a neutral response plus an email to the existing owner, or accept and rate-limit |
| 3 | No per-account lockout; defence is an in-memory per-IP limit (10/min) that is per process | Slow distributed guessing is not limited | Per-account/credential counters in Redis with back-off; qualify a shared store |
| 4 | Behind a proxy without `TRUST_PROXY=true` all clients share one IP and one bucket | Self-inflicted lockouts; one abuser locks everyone out | `STACK_TRUST_PROXY=true` behind exactly one trusted proxy only |
| 5 | Session/CSRF cookies are `Secure=false` when `NODE_ENV=development`; they are `SameSite=Strict` | Cookies would travel over http if the stack were reached that way | Confirm `Secure` is set in production builds before any release |
| 6 | Password-reset mail is queued and sent by the worker sweep (about 20–60 s) while registration mail is inline | Slow "Send code" experience | Keep (it avoids a timing side channel) or shorten the sweep / enqueue an immediate job |
| 7 | Admin accounts with an unverified email see raw `CONTACT_VERIFICATION_REQUIRED` and the admin app has no verification screen | Staff locked out of the owner area | Add a verification step (or reuse the customer flow) and a readable message |
| 8 | Only `LogInForm`/`SignUpForm` use `authErrorMessage`; other forms still read `errData.message` from a possibly undefined body (e.g. `LogOutAccount`) | A network error can throw instead of showing a message | Use the helper everywhere |
| 9 | `/auth/user-details` (post-sign-up profile) was **not exercised**; the typechecker reports `userDetails` missing on `Profile` and `country` unknown in `TwiPayProfileUpdate` | Possible broken profile step | Test and fix |
| 10 | `login` rejects an email with surrounding spaces (400) while register normalizes | Minor UX | Trim before validation |
| 11 | The marketing mock-up on the auth pages shows a fabricated balance and name | Misleading (README already says it is not the real dashboard) | Replace or label |

## How it was tested
Playwright against the Docker stack with the public (Tailscale Funnel) origins mapped to the local services inside the test
browser, plus direct API probes. Rate-limit and brute-force probes restart the API first because the limiter is in memory.
