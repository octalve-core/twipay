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
