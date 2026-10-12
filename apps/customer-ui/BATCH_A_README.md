# TwiPay Customer UI — Preserved ErhaPay Design Candidate

This directory preserves the original ErhaPay React/Vite customer UI, page hierarchy, Tailwind classes, and **original logo image asset**. It is an isolated migration candidate, **not yet the production customer app**. The existing `apps/web` Next.js implementation has **not** been overwritten.

## What is actually wired
- `POST /v1/auth/register` — server creates identity and HttpOnly session; old 4-step email OTP assumption removed from the displayed signup flow.
- `POST /v1/auth/login` — opaque session cookie, no browser bearer token.
- `GET /v1/auth/me` — validates on mount and refresh; source of identity.
- `POST /v1/auth/logout` — revokes server session and clears client display state.
- `GET /v1/auth/mfa/status`, `POST /v1/auth/mfa/challenge` — enrolled TOTP code challenge (not email OTP).
- `GET /v1/auth/csrf` — CSRF token for supported authenticated mutations.

## Not ready / fail-closed
All old BillPadi finance, bills, travel, profiles and support requests are rejected by the frontend API allow-list until separately mapped, verified and tested against TwiPay API routes. UI visibility is not an authorization boundary; the TwiPay backend remains authoritative.

Betting is **permanently excluded** and should never be enabled. The archived original source still contains those unused components for preservation/diff review, but no active route or navigation exports them.

E-PIN, international airtime/data, eSIM, mobile money, virtual cards, flights/hotels and referrals/affiliate interfaces are preserved in source but **inactive until future explicit approval and supported API**. No fake card balance or card number should be shown to customers.

Legacy settings/MFA enrollment, email/phone verification and reset forms need purpose-built TwiPay API integrations; old routes are not active. Public legal copy, testimonials and partnership badges require factual/legal approval before launch.

## Local validation
Set `VITE_TWIPAY_API_URL=http://localhost:4000` in `apps/customer-ui/.env.local` and configure API `APP_URL` to the *exact* Vite origin, normally `http://localhost:5173`. `pnpm --filter @twipay/customer-ui dev` runs the original Vite customer UI. For a test environment, use only disposable accounts and sandbox providers.

Cookie authentication requires schemeful same-site browser/API hosts in production (e.g. app.twipay.co and api.twipay.co with HTTPS), strict allowed origins and secure host-only cookies. Do not use `localhost` as a production fallback.

**Do not deploy this candidate as production** until real Node/pnpm builds, browser auth/cookie/CSRF tests, UI visual baselines, endpoint integrations and staging acceptance pass.
