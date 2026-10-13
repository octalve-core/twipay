# Running the whole stack in Docker

`compose.stack.yaml` runs PostgreSQL 18, Redis 8, migrations, the API, the worker, the admin console and the customer UI.
It is for **local development and demos only**: `NODE_ENV=development`, every financial/provider switch stays off, and
outgoing email goes to a local inbox (see [ADR 021](../adr/021-local-dev-mail-inbox.md)).

## Prerequisites
- Docker with Compose v2, and a root `.env` copied from `.env.example` and filled in. `TRANSACTION_PIN_PEPPER` is
  required by the phase 3 code (32+ characters). Secrets stay in `.env` (git-ignored); the stack overrides only the
  connection strings, URLs and `RESEND_*`.

## Start
```bash
docker compose -f compose.stack.yaml up -d --build
```

| Service | Default URL | Notes |
| :--- | :--- | :--- |
| Customer UI | `http://localhost:3000` | nginx serving the static Vite build |
| Admin | `http://localhost:3001` | Next.js, `next start` |
| API | `http://localhost:4000` (`/docs` for OpenAPI) | Fastify/Nest, compiled `dist` |
| Dev inbox | `http://localhost:8025` | also reachable as the floating button in both apps |
| PostgreSQL / Redis | `127.0.0.1:5435` / `127.0.0.1:6382` | named volumes survive `down` |

Ports are configurable: `CUSTOMER_UI_PORT`, `ADMIN_PORT`, `API_PORT`, `DEVMAIL_PORT`. Example when 3000 is taken:
`CUSTOMER_UI_PORT=3002 docker compose -f compose.stack.yaml up -d --build`.

## Public origins are baked into the front ends
The API accepts browser requests only from `APP_URL` and `ADMIN_URL`, and both front ends have the API URL compiled in.
When the URLs you open differ from `localhost`, set all three origins and **rebuild**:

```bash
CUSTOMER_UI_ORIGIN=https://host.example.ts.net \
ADMIN_ORIGIN=https://host.example.ts.net:8443 \
API_ORIGIN=https://host.example.ts.net:10000 \
STACK_TRUST_PROXY=true \
docker compose -f compose.stack.yaml up -d --build
```

Keep all three on **one hostname** (ports may differ) so the `SameSite=Strict` session and CSRF cookies stay same-site.
Set `STACK_TRUST_PROXY=true` only when a proxy sits in front: without it every visitor shares the proxy's IP and
therefore one login rate-limit bucket (10 per minute); with it on a directly exposed API, clients could spoof their IP.

### Tailscale Funnel
```bash
sudo tailscale funnel --bg --https=443   http://127.0.0.1:3000   # customer UI (use your CUSTOMER_UI_PORT)
sudo tailscale funnel --bg --https=8443  http://127.0.0.1:3001   # admin
sudo tailscale funnel --bg --https=10000 http://127.0.0.1:4000   # API
sudo tailscale funnel reset                                       # turn it off again
```
Funnel only allows those three ports. Machines on the tailnet resolve the name immediately; the **public DNS record can
take 10–20 minutes** to appear (check `dig +short <host> A @8.8.8.8`). While Funnel is on, anyone with the link can read
the dev inbox and use the demo accounts: use a throwaway account and turn Funnel off afterwards.

## Day-to-day
- `docker compose -f compose.stack.yaml logs -f api worker` — logs.
- `docker compose -f compose.stack.yaml down` — stop (volumes kept). Add `-v` only to wipe the database.
- Rebuild after a code change: `docker compose -f compose.stack.yaml up -d --build <service>`. The `api` and `migrate`
  services share one image built from the `migrate` service's `build:`; build `migrate` to rebuild the API image.
  The pnpm store is a BuildKit cache mount, so only the first build downloads packages.
- Quick iteration without a rebuild: build on the host and `docker cp` the output into the running container; it is lost on
  recreate, so finish with a real `--build`.

## Gotchas
- **`pnpm dev` for the API does not work**: `tsx` (esbuild) emits no decorator metadata, so Nest dependency injection yields
  `undefined` services and requests fail with 500. Build with `tsc` and run `node apps/api/dist/main.js` (the images do).
- API requests need an allowed `Origin` header; without it the guard answers 403 `ORIGIN_NOT_ALLOWED`.
- `@twipay/customer-ui` still has 30 type errors, so its image builds with `vite build` rather than `tsc -b`.
- Dependencies installed with `ERR_PNPM_IGNORED_BUILDS` need an explicit `allowBuilds` decision in `pnpm-workspace.yaml`.
- `docker compose down` also removes the PostgreSQL/Redis containers of the included `compose.yaml` (volumes are kept).
