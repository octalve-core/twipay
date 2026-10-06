# TwiPay Security Policy

TwiPay is treated as a high-value financial system. Security controls are architectural requirements.

## Non-negotiable rules

1. Never commit production/test secrets, private keys, raw provider credentials, `.env` files, BVN/NIN values, card data, authentication tokens, or session cookies.
2. Browser-visible code must be assumed inspectable. Authorization is always enforced server-side.
3. Long-lived authentication material must never be stored in `localStorage` or `sessionStorage`.
4. Web sessions use opaque random tokens in `HttpOnly`, `Secure`, `SameSite=Strict` cookies; only a one-way hash is stored server-side.
5. Unsafe HTTP requests are restricted by exact CORS allowlists plus origin/fetch-metadata checks. Provider webhook routes use provider signature verification, not browser sessions.
6. Passwords use Argon2id. Passwords, OTPs, reset tokens and secrets must never be logged.
7. Sensitive identifiers and secrets must not be placed in URLs/query strings.
8. All object access must be authorized against the authenticated principal; possession of an ID is not authorization.
9. Admin/operations access uses separate roles and stronger MFA. Financial administrative actions will use maker/checker controls.
10. Financial writes must later use ledger transactions and idempotency (Batch 2); direct mutable-balance patterns are prohibited.
11. CVV must never be stored. Prefer PSP-hosted/tokenized card flows.
12. Production secrets belong in deployment secret stores. `.env.example` documents names only.

## Standards

- OWASP ASVS 5 Level 2 baseline, Level 3 controls for auth, financial operations, KYC and administration.
- OWASP API Security Top 10.
- OAuth 2.0/OIDC Authorization Code + PKCE for Google login.
- JWT BCP if/when JWT is used for non-browser API clients.

See `docs/security/security-model.md` and `docs/security/threat-model.md`.
