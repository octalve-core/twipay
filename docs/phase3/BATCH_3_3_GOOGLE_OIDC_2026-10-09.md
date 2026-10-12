# TwiPay — Phase 3 / Batch 3.3: Google OIDC and protected linking

**Date:** 2026-10-09 (Africa/Lagos). **Input Git:** `ec081f18f24573b5bd1299719bb4267d32e0793f`. **Status:** Source implementation with offline evidence, NOT real-provider approval or runtime qualification. Continue in SAME Git-backed repository and Library master; original ErhaPay UI is the sole customer design authority.

## Boundary and architecture

- The existing NestJS/Fastify API owns the Google authorization-code OpenID Connect flow, using pre-existing `openid-client@6.8.8`. Discovery is pinned to the Google issuer `https://accounts.google.com`. The client never receives Google ID/access/refresh tokens and never uses Firebase popup/localStorage bearer authentication. Historical `src/lib/firebase.ts` remains unimported and out of this flow; remove unused legacy dependencies only after verified dependency/build analysis.
- The flow is **default-off**. `GOOGLE_OIDC_ENABLED=false` by default; `GET /v1/auth/google/status` reveals only availability, not credentials. The ErhaPay-derived Google button is shown ONLY when a complete approved runtime configuration exists. It reuses original auth page layout, CustomButton, responsive breakpoints, colors and 123 unmodified design assets, including the temporary original logo.
- Server generates independent unpredictable `state`, PKCE verifier, OIDC `nonce`, and browser binding. The code verifier is AES-256-GCM encrypted with a distinct `GOOGLE_OIDC_TRANSACTION_KEY` at rest; only peppered HMACs of state and browser binding are stored. Browser binding uses an HttpOnly, 5-minute, `SameSite=Lax`, path-restricted callback cookie (Secure in production). This is deliberately separate from TwiPay's `SameSite=Strict` authenticated session cookie.
- A five-minute DB challenge is atomically consumed with a conditional UPDATE **before** provider token exchange: wrong browser binding, expiry, replay or concurrent callback cannot produce another valid login. Provider claims are validated with `openid-client` (issuer/audience/time/signature/nonce/PKCE through library) plus explicit issuer, unique `sub`, and `email_verified=true` checks. No unverified provider email can create a verified TwiPay account.
- Google `sub` (`OAuthIdentity.provider='GOOGLE'`, `providerSubject`) is the stable identity key. A Google account matching an existing TwiPay email **never** automatically links or logs into that TwiPay user; the customer must sign in using the existing method and explicitly link Google.
- New verified Google email creates an `ACTIVE` user with `emailVerifiedAt` set and a Google identity, no invented password and no compulsory onboarding wizard. The regular `/auth/me` verified-contact/MFA guard remains authoritative. Successful Google login mints a fresh opaque TwiPay session with MFA unsatisfied. Financial eligibility is NOT changed; payment/transfer/provider features remain default-off.
- Linking (`POST /auth/google/link/start`) requires already authenticated and contact-verified SessionAuthGuard, satisfied existing MFA, TwiPay's session-bound CSRF, strict browser Origin, and fresh current-password proof. Pending challenge binds to the initiating user/session. Callback checks session ACTIVE/expiry/idle, account contact status, MFA assurance and provider-subject uniqueness, and locks user/session rows to coordinate with revocations. It never updates the TwiPay account email to Google email, and it never issues a login session from a link callback. OAuth-only users do not have a password for linking; alternate verified step-up credential management belongs in later Phase 3 work.

## Added/modified API routes (`/v1/auth`)

| Route | Authentication / protection | Outcome |
|---|---|---|
| `GET google/status` | Public, no secret exposure | `{enabled:boolean}` |
| `POST google/start` | Public but strict Origin, ingress/IP limiter | `{authorizationUrl}` + HttpOnly callback binding cookie |
| `GET google/callback` | Google top-level redirect; state + cookie + PKCE + nonce | 303 to frontend completion page with only safe result; successful sign-in sets opaque TwiPay cookies |
| `GET google/link/status` | Verified authenticated session, MFA guard | `{linked:boolean}` |
| `POST google/link/start` | Verified authenticated session, MFA, session CSRF, password proof | `{authorizationUrl}` + callback binding cookie |

A different domain/subdomain deployment must be assessed for same-site browser cookie behavior; don't infer success from source tests. Only a trusted API hostname may receive the registered callback. Do not use user-supplied return URLs or unapproved providers.

## Database and configuration

- Additive Prisma migration `0008_google_oidc_transactions` creates one-time transaction storage with HMAC state/binding, AES-GCM verifier, nonce, optional user/session binding, expiry and consumed timestamp. No changes to immutable ledger, wallet or financial model.
- `.env.example` defines `GOOGLE_OIDC_ENABLED=false`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, exact `GOOGLE_REDIRECT_URI` `/v1/auth/google/callback`, and distinct 32-byte base64 `GOOGLE_OIDC_TRANSACTION_KEY`. The environment checker requires complete configuration when enabled. Do not commit secrets. Google Console must register the exact API redirect URI. Enable only after real-provider and browser-security qualifications.
- OIDC challenge retention/cleanup, global distributed rate limiting and full Google-provider failure E2E remain release hardening duties. Fastify rate limiting currently protects against basic per-process abuse only.

## Actual evidence and pending gates

- Offline 270/270 source/isolated/transpiled-with-mocks tests passed (15 new Google OIDC behavioral tests). Negative coverage: wrong binding, expiry, nonce, code replay, concurrent callback, unverified email, existing-email collision, incorrect link password, revoked original session, transferred Google subject. These are NOT real Google-signed JWT, PostgreSQL or HTTP tests.
- TypeScript syntax scanner and repository/security/architecture/financial/services/events/product operations/production hardening scanners passed. ErhaPay inventory: 330 customer source files, 66 routes, 123 original image assets, 0 material asset changes. This is NOT visual/browser parity.
- Node 24 frozen dependencies, Prisma migrations/real PostgreSQL 18 transaction contention, Redis 8, real Fastify CSRF/cookie checks, browser redirects and CORS, OAuth provider discovery/exchange/JWK rotation, approved OAuth client credentials, real Google sandbox identity and email/security flows are **NOT EXECUTED** in this environment (Node 22, missing pnpm lock and services). No release/production claims.
- Future prerequisite: Google-only customers need a verified step-up route for creating password credentials or enrolling MFA if that is required by subsequent account-security policies. Never silently fake a password or circumvent MFA. Transaction PIN remains mandatory for covered financial intents, addressed in later phases.

**Next phase:** Phase 3.4 MFA/account recovery and transaction PIN credential setup, while keeping release qualification deferred only as a runtime exercise, NOT waived.

**References:** [Google ID token validation](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token); [openid-client authorization-code grant](https://github.com/panva/openid-client/blob/main/docs/functions/authorizationCodeGrant.md).
