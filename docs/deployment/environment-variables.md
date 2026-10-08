# Environment variable contract

`.env.example` is names/placeholders only. Values are injected per environment through an approved secret/config store; never promote a populated `.env` file. Rotate secret values after suspected exposure and never expose server-only values through `NEXT_PUBLIC_*`.

| Group | Variables | Secret? | Scope / rotation note |
|---|---|---:|---|
| origins/runtime | `NODE_ENV`, `APP_URL`, `ADMIN_URL`, `API_URL`, `NEXT_PUBLIC_API_URL`, `API_PORT`, `TRUST_PROXY`, `OPENAPI_DOCS_ENABLED` | No | per environment; only `NEXT_PUBLIC_API_URL` is intentionally browser-visible |
| database/queue | `DATABASE_URL`, `REDIS_URL` | Yes | API/worker; rotate credentials using managed-service procedure |
| sessions | `SESSION_HASH_PEPPER`, `SESSION_ABSOLUTE_TTL_SECONDS`, `SESSION_IDLE_TTL_SECONDS`, `SESSION_TOUCH_INTERVAL_SECONDS` | pepper yes | API; pepper rotation invalidates lookup of existing sessions and therefore requires controlled session revocation |
| MFA | `MFA_RECOVERY_HMAC_KEY`, `MFA_TOTP_ISSUER`, `MFA_ENROLLMENT_TTL_SECONDS`, `MFA_MAX_FAILED_ATTEMPTS`, `MFA_LOCK_SECONDS`, `MFA_STEP_UP_MAX_AGE_SECONDS` | HMAC key yes | API; HMAC-key rotation invalidates unconsumed recovery-code lookup unless migrated/versioned |
| release latch | `HIGH_RISK_FEATURES_RELEASE_QUALIFIED` | No | API; must remain `false` for development/RC and until the signed production release matrix has no mandatory FAIL/BLOCKED gates |
| sensitive data | `DATA_ENCRYPTION_KEY`, `PII_FINGERPRINT_KEY` | Yes | API/worker; rotation requires an explicit versioned migration so existing ciphertext/lookups remain usable |
| OIDC | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | secret yes | API; provider console + secret store |
| payments | `PAYSTACK_SECRET_KEY`, `PAYSTACK_BASE_URL`, `MONNIFY_API_KEY`, `MONNIFY_SECRET_KEY`, `MONNIFY_CONTRACT_CODE`, `MONNIFY_SOURCE_ACCOUNT_NUMBER`, `MONNIFY_BASE_URL`, `MONNIFY_ALLOW_UNSIGNED_SANDBOX_WEBHOOKS` | credentials yes | API; separate sandbox/live; unsigned switch must be false in production |
| identity | `MONO_SECRET_KEY`, `MONO_BASE_URL` | key yes | API; sandbox/test vs live separation |
| bills | `VTPASS_API_KEY`, `VTPASS_PUBLIC_KEY`, `VTPASS_SECRET_KEY`, `VTPASS_BASE_URL` | credentials yes | API; sandbox/live separation |
| notifications | `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_CHANNEL`, `TERMII_BASE_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_BASE_URL` | keys yes | API/worker; rotate in provider + secret store |
| tickets | `TICKET_SIGNING_KEYS_JSON`, `TICKET_SIGNING_CURRENT_VERSION` | key map yes | API; add new version before switch; retain old versions while valid tickets exist |
| domain policy | `BILL_VALIDATION_TTL_MINUTES`, `BILL_RECONCILE_MAX_ATTEMPTS`, `BILL_RECONCILE_BASE_DELAY_MS`, `BILL_RECONCILE_MAX_DELAY_MS`, `EVENT_PLATFORM_FEE_BPS`, `EVENT_ORDER_EXPIRY_MINUTES` | No | API/worker; change only through reviewed release/config process |
| worker | `WORKER_RECOVERY_SWEEP_MS`, `NOTIFICATION_MAX_ATTEMPTS`, `NOTIFICATION_RETRY_DELAY_MS`, `NOTIFICATION_PROCESSING_STALE_MS` | No | worker/API shared domain configuration |
| observability | `SENTRY_DSN`, `LOG_LEVEL` | DSN sensitive config | server-side; do not log secrets/PII |

Live provider/API keys are not needed to build the repository and must never appear in Git, fixtures, screenshots or release evidence.
