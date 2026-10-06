# Configuration and Secrets

`.env.example` contains names only. Real values belong in the deployment platform's encrypted environment/secret store.

| Variable | Purpose | Secret? | Browser allowed? |
|---|---|---:|---:|
| `APP_URL` | customer web origin | No | Yes |
| `ADMIN_URL` | admin origin | No | Yes |
| `API_URL` | server-side API origin | No | No |
| `NEXT_PUBLIC_API_URL` | browser-visible API origin only | No | Yes |
| `DATABASE_URL` | PostgreSQL credential | Yes | No |
| `REDIS_URL` | Redis credential | Yes | No |
| `SESSION_HASH_PEPPER` | protects server-side token hashes | Yes | No |
| `GOOGLE_CLIENT_ID` | Google OIDC client | Sensitive config | Server preferred |
| `GOOGLE_CLIENT_SECRET` | Google OIDC secret | Yes | No |
| provider secret keys | provider authentication | Yes | No |

Production values should later live in AWS Secrets Manager/KMS or an equivalent managed secret store. Vercel/Railway environment variables may be used for server-side secrets only when those processes run there.
