# Review harness

Playwright scripts for reviewing the running stack in a real browser. Not part of CI. They create throwaway
`@example.test` accounts and read verification codes from the dev inbox ([ADR 021](../../docs/adr/021-local-dev-mail-inbox.md)).

Prerequisite: the stack from [docs/development/docker-stack.md](../../docs/development/docker-stack.md) is up.

| Script | Purpose |
| :--- | :--- |
| `journey-customer-auth.mjs` | sign-up validation, register, wrong then correct code, dashboard, reload |
| `capture-routes.mjs` | every customer route (and admin pages with `INCLUDE_ADMIN=1`): screenshot + console/API problems table; `PROBE_BUTTONS=1` clicks only safe-labelled buttons, never submits forms |
| `api-probes.mjs B\|C\|D` | register/login variants, origin/CSRF guards, brute-force. Restart the API before `D` (in-memory limiter) |

## Configuration (environment)
- Local ports (default): `REVIEW_UI=http://localhost:3002 REVIEW_ADMIN=http://localhost:3001 REVIEW_API=http://localhost:4000`.
- Stack built with public origins baked in (Funnel): set `REVIEW_PUBLIC_HOST=<host>`. The browser then sees
  `https://<host>`, `:8443`, `:10000` while Playwright serves them from localhost; no sockets are opened.
- `SHOTS=docs/screenshots/<dated-folder>` where screenshots go. `REVIEW_MAIL` defaults to `http://127.0.0.1:8025`.

```bash
REVIEW_PUBLIC_HOST=rojitech.taildf7871.ts.net SHOTS=docs/screenshots/2026-10-14-routes \
  node scripts/review-harness/capture-routes.mjs
```
