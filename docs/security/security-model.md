# Security Model

## Trust boundaries
1. Browser is untrusted and inspectable.
2. Edge/WAF reduces hostile traffic but does not authorize users.
3. API is the security enforcement point.
4. Database and Redis are private infrastructure.
5. Every provider response/webhook is untrusted until authenticated and validated.
6. Admin users remain least-privileged and auditable.

## Browser protections
- Exact origin allowlist; no wildcard CORS with credentials.
- HttpOnly session cookie.
- SameSite=Strict and CSRF token/origin enforcement for state changes.
- CSP is finalized when UI dependencies are known; no permissive wildcard policy is accepted for production.
- HSTS in production; `nosniff`, no-referrer, frame denial and restrictive permissions policy.

## Data exposure
Secrets and regulated identifiers are server-only. URLs must not contain provider secrets, passwords, tokens, BVN, NIN, card data, or recovery secrets. Structured logs use redaction.

## Access control
Authentication identifies the principal; authorization separately verifies action, role, ownership and context. Object IDs are never treated as permissions.

## Abuse controls
Application rate limiting is enabled globally. Authentication-specific and provider-specific limits are tightened before public launch. `TRUST_PROXY` stays false unless the deployment path has a trusted reverse proxy; otherwise client-IP headers could be spoofed.

## Task 5 browser/API audit (2026-10-08)
- API CORS compares the exact `Origin` against `APP_URL` and `ADMIN_URL` with credentials enabled; authenticated unsafe browser requests require CSRF cookie/header and a session-bound server hash. Webhooks are exempt from browser CSRF but require independent provider signature verification.
- Customer/admin Next.js request proxies set nonce-based CSP; API Fastify Helmet provides API-specific security headers. **A running browser CSP test remains mandatory**; static review is not proof that every UI asset is allowed.
- Risk-rate-policy matching now includes actual `/v1/finance/transfers`, `/v1/services/purchases`, `/v1/events/checkout`, finance approval routes, PATCH admin routes and product configuration changes. Unit policy tests are in `apps/api/test/risk-rate-policy.test.mjs`.
- The default Fastify rate-limit store is per-process. A multi-replica deployment MUST qualify an approved distributed limiter (Redis-backed Fastify store or enforced edge policy). Setting an external limiter without verifying rule deployment is not a PASS.
- Access-log request serialization deliberately removes query strings and fragments. Do not transmit credentials or identity data in URLs regardless of this defense in depth.
- Remaining gates: genuine dependency-backed compile/API requests; browser CORS, CSRF and CSP; log-output inspection; penetration/BOLA tests; distributed limiter multi-instance proof; Redis/Postgres integration; provider sandbox and staging DAST.
