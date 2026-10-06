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
