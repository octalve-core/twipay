# Configuration and Secrets

`.env.example` contains **names/placeholders only**. Real values belong in the deployment platform's encrypted environment/secret store. Never commit a populated `.env`, provider credential, database password, signing material, BVN/NIN, OTP, access token or production account detail.

## Public/base configuration

| Variable | Purpose | Secret? | Browser allowed? |
|---|---|---:|---:|
| `APP_URL` | customer web origin | No | Yes |
| `ADMIN_URL` | admin origin | No | Yes |
| `API_URL` | server-side API origin | No | No |
| `NEXT_PUBLIC_API_URL` | browser-visible API origin only | No | Yes |
| `API_PORT` | API listen port | No | No |
| `TRUST_PROXY` | enables trusted reverse-proxy handling when deployment topology requires it | No | No |
| `OPENAPI_DOCS_ENABLED` | explicitly exposes Swagger UI; keep `false` in production unless intentionally enabled | No | No |
| `LOG_LEVEL` | structured server log level | No | No |

## Core server-only secrets

| Variable | Purpose | Secret? | Browser allowed? |
|---|---|---:|---:|
| `DATABASE_URL` | PostgreSQL credential | Yes | No |
| `REDIS_URL` | Redis credential | Yes | No |
| `SESSION_HASH_PEPPER` | HMAC key protecting stored opaque-session token digests | Yes | No |
| `DATA_ENCRYPTION_KEY` | AES-256-GCM key protecting BVN/NIN, bank-account values and encrypted idempotency replay bodies | Yes | No |
| `PII_FINGERPRINT_KEY` | HMAC key for deterministic sensitive-value fingerprints used for lookup/deduplication without plaintext storage | Yes | No |
| `GOOGLE_CLIENT_ID` | Google OIDC client configuration | Sensitive config | Server preferred |
| `GOOGLE_CLIENT_SECRET` | Google OIDC secret | Yes | No |

`DATA_ENCRYPTION_KEY` **must be base64 that decodes to exactly 32 random bytes**. For a local-only development value, generate it outside source control, for example:

```bash
openssl rand -base64 32
```

Use a different value for development, staging and production. Do not rotate this key casually: ciphertext written with the current key must remain decryptable until an explicit key-versioned rotation/migration is performed. `PII_FINGERPRINT_KEY` and `SESSION_HASH_PEPPER` must also be high-entropy server-only secrets and must differ between environments.

## Batch 2 provider configuration

| Variable | Purpose | Secret? | Browser allowed? |
|---|---|---:|---:|
| `PAYSTACK_SECRET_KEY` | Paystack server authentication + webhook verification | Yes | No |
| `PAYSTACK_BASE_URL` | optional Paystack API host override | No | No |
| `MONNIFY_API_KEY` | Monnify server credential | Yes | No |
| `MONNIFY_SECRET_KEY` | Monnify server credential + webhook verification | Yes | No |
| `MONNIFY_CONTRACT_CODE` | Monnify merchant contract identifier | Sensitive config | No |
| `MONNIFY_SOURCE_ACCOUNT_NUMBER` | Monnify payout source account; required before enabling Monnify payouts | Sensitive config | No |
| `MONNIFY_BASE_URL` | sandbox/production API host | No | No |
| `MONNIFY_ALLOW_UNSIGNED_SANDBOX_WEBHOOKS` | explicit sandbox-only compatibility switch; never use to permit unsigned production webhooks | No | No |
| `MONO_SECRET_KEY` | Mono identity-verification credential | Yes | No |
| `MONO_BASE_URL` | Mono API host override | No | No |

Provider credentials are deliberately optional at application boot so a developer can run modules that do not use a provider. The registry fails closed with `*_NOT_CONFIGURED` when an unconfigured adapter is actually requested.

## Environment separation

Development, test, staging and production must not reuse secrets, databases or provider live/test keys. Production values should ultimately live in AWS Secrets Manager/KMS or an equivalent managed secret store. Vercel/Railway environment variables may be used only for secrets consumed by server-side processes running there.

The repository and documentation may describe **variable names and rotation procedures**, never their live values.

`MONNIFY_ALLOW_UNSIGNED_SANDBOX_WEBHOOKS` is an explicit compatibility switch for sandbox-only testing and must remain `false` in production. The Monnify adapter also rejects unsigned events when pointed at the production host even if the switch is accidentally enabled.

## Batch 3 service/event/notification configuration

| Variable | Purpose | Secret? | Browser allowed? |
|---|---|---:|---:|
| `VTPASS_API_KEY` | VTpass server credential | Yes | No |
| `VTPASS_PUBLIC_KEY` | VTpass server-side GET credential | Sensitive | No |
| `VTPASS_SECRET_KEY` | VTpass server-side POST credential | Yes | No |
| `VTPASS_BASE_URL` | VTpass sandbox/live host | No | No |
| `TERMII_API_KEY` | Termii messaging credential | Yes | No |
| `TERMII_SENDER_ID` | approved sender identity | Sensitive config | No |
| `TERMII_CHANNEL` | Termii routing channel | No | No |
| `TERMII_BASE_URL` | Termii regional API host | No | No |
| `RESEND_API_KEY` | Resend server credential | Yes | No |
| `RESEND_FROM` | verified sender address | Sensitive config | No |
| `RESEND_BASE_URL` | Resend API host override | No | No |
| `TICKET_SIGNING_KEYS_JSON` | version -> ticket HMAC secret key map | **Yes** | **No** |
| `TICKET_SIGNING_CURRENT_VERSION` | currently active ticket key version | No | No |
| `BILL_VALIDATION_TTL_MINUTES` | local reuse window for provider customer validation | No | No |
| `BILL_RECONCILE_MAX_ATTEMPTS` | bounded same-provider automatic reconciliation count | No | No |
| `BILL_RECONCILE_BASE_DELAY_MS` | initial reconciliation backoff | No | No |
| `BILL_RECONCILE_MAX_DELAY_MS` | reconciliation backoff cap | No | No |
| `EVENT_PLATFORM_FEE_BPS` | configurable event fee, defaults to `0` | No | No |
| `EVENT_ORDER_EXPIRY_MINUTES` | checkout reservation expiry policy | No | No |
| `WORKER_RECOVERY_SWEEP_MS` | bounded recovery sweep interval | No | No |
| `NOTIFICATION_MAX_ATTEMPTS` | delivery retry cap | No | No |
| `NOTIFICATION_RETRY_DELAY_MS` | notification retry delay | No | No |
| `NOTIFICATION_PROCESSING_STALE_MS` | recovery threshold for interrupted delivery | No | No |

`TICKET_SIGNING_KEYS_JSON` must never be a `NEXT_PUBLIC_*` value. Keep old key versions available while any ticket signed with them can still legitimately be presented. Key removal is an explicit operational/security migration, not routine cleanup.
