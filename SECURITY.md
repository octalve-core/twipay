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
10. Financial writes use the Batch 2 double-entry ledger, immutable journals, holds and user-scoped idempotency; direct mutable-balance patterns are prohibited.
11. CVV must never be stored. Prefer PSP-hosted/tokenized card flows.
12. Production secrets belong in deployment secret stores. `.env.example` documents names only. Sensitive persisted values use the documented encryption/fingerprint policy and are never duplicated into plaintext idempotency/audit stores.

## Standards

- OWASP ASVS 5 Level 2 baseline, Level 3 controls for auth, financial operations, KYC and administration.
- OWASP API Security Top 10.
- OAuth 2.0/OIDC Authorization Code + PKCE for Google login.
- JWT BCP if/when JWT is used for non-browser API clients.

See `docs/security/security-model.md` and `docs/security/threat-model.md`.


## Financial controls

- Ledger journals are append-only, created OPEN and sealed once only after the database verifies at least two balanced entries.
- Corrections/reversals create compensating journals; historical entries are not edited.
- Wallet availability is derived from sealed ledger entries minus ACTIVE holds. Spend reservation locks the wallet row before evaluating availability.
- Provider timeout/ambiguity becomes `UNKNOWN` and is reconciled; it is never treated as proof of failure.
- Signed payment webhooks are evidence, not authority to credit money. TwiPay re-queries the provider server-to-server before settlement and validates expected amount/currency.
- Beneficiary/virtual-account numbers and BVN/NIN identifiers are encrypted at rest; deterministic keyed fingerprints support safe matching without plaintext lookup columns.
- Idempotency replay bodies are encrypted at rest because they can contain checkout URLs or account details.

See `docs/security/financial-security.md`.
