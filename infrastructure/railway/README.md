# Railway initial runtime profile

TwiPay remains portable. Railway is an initial container runtime, not an application dependency.

Create four independent services from the same repository, each building its committed Dockerfile:

| Service | Dockerfile | Public? | Health/start note |
|---|---|---:|---|
| web | `infrastructure/docker/Dockerfile.web` | Yes | customer origin, port 3000 |
| admin | `infrastructure/docker/Dockerfile.admin` | Restricted public edge | operations origin, port 3001 |
| api | `infrastructure/docker/Dockerfile.api` | Yes through Cloudflare | `/v1/health/live`, port 4000 |
| worker | `infrastructure/docker/Dockerfile.worker` | No | no inbound public port |

Use a PostgreSQL 18-compatible managed database and TLS Redis endpoint. Inject server-only secrets through the runtime secret store. Do not share production provider credentials with preview services. Run `prisma migrate deploy` as an explicit release step before shifting traffic to code that requires a migration.

The four Dockerfiles deliberately require a committed genuine `pnpm-lock.yaml`; deployments must fail rather than synthesize dependency resolution during release.
