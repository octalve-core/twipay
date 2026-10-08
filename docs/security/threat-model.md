# Threat Model — Batch 1 Baseline

| Threat | Initial control |
|---|---|
| Credential theft via XSS | HttpOnly session; no auth tokens in localStorage; CSP planned with final UI |
| CSRF | SameSite=Strict; exact CORS; CSRF token hash in session; unsafe request enforcement before interactive release |
| Session database theft | Only token hashes stored; pepper held outside DB |
| Password database theft | Argon2id hashes |
| Credential stuffing | Generic auth errors; rate limiting at edge + API in release hardening |
| BOLA/IDOR | Ownership/permission checks are application-layer requirement |
| Secret leakage | `.env` ignored; `.env.example` empty; repository scanner; structured log redaction |
| OAuth interception | Authorization Code + PKCE + state; exact redirect URI |
| Admin privilege abuse | Separate admin app; RBAC baseline; MFA/maker-checker later before financial actions |
| Provider compromise | Adapter isolation; verification and reconciliation in later batches |

## Task 5 evidence and residual risk (2026-10-08)
| Threat | Source-level response | Remaining qualification |
|---|---|---|
| Transfer/admin rate-limit fall-through | Correct route and unsafe-method classification | Running Fastify and distributed multi-instance proof |
| Sensitive query material in access logs | Request serializer now omits query and fragment | Live structured-log capture and redaction review |
| Forged browser request | Exact Origin, CSRF cookie/header plus session hash inspected | Real browser/API attack regressions |
| Webhook forgery/replay | Provider signature verification and inbox dedup inspected | Provider failure/sandbox and concurrent delivery tests |
| Browser XSS | Nonce CSP proxies and strict API Helmet config inspected | Browser E2E/CSP violation telemetry |
| Privileged route TOCTOU | Task 4 transactional guards cover payout request and approval entry points | Remaining admin/finance pathways, PostgreSQL concurrency and revocation races |
