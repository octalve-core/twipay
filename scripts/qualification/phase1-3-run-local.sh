#!/usr/bin/env bash
# Only for an authorized local qualification workstation with Node 24, exact pnpm, Docker.
# A disposable database and Redis are created; all financial/provider flags remain OFF.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
MODE="${1:-}"
if [[ "$MODE" != --prepare-lock && "$MODE" != --qualify && "$MODE" != --smoke ]]; then
  echo 'Usage: scripts/qualification/phase1-3-run-local.sh --prepare-lock|--qualify|--smoke' >&2; exit 2
fi
if [[ "$(node -p 'process.versions.node.split(".")[0]')" != 24 ]]; then
  echo 'BLOCKED: Node 24 required. Do not bypass package engine checks.' >&2; exit 2
fi
expected="$(node -p 'require("./package.json").packageManager.split("@")[1]')"
if ! command -v pnpm >/dev/null 2>&1 || [[ "$(pnpm --version)" != "$expected" ]]; then
  echo "BLOCKED: Required exact pnpm $expected. Install with trusted Corepack tooling." >&2; exit 2
fi
if [[ "$MODE" == --prepare-lock ]]; then
  # This must run with network access. Never hand-author a pnpm lockfile.
  pnpm install --lockfile-only --ignore-scripts --no-frozen-lockfile
  node scripts/qualification/phase1-3-preflight.mjs
  echo 'Review package changes and commit the genuine pnpm-lock.yaml before qualification.'
  exit 0
fi
if [[ ! -f pnpm-lock.yaml ]]; then
  echo 'BLOCKED: first generate and commit the complete lockfile using --prepare-lock.' >&2; exit 2
fi
# This must be a disposable environment, never reuse the developer's actual TwiPay database.
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo 'BLOCKED: Docker Compose is required for isolated PostgreSQL/Redis qualification.' >&2; exit 2
fi
# Refuse all local application environment files because package test scripts may
# load them automatically (including provider secrets) even if the shell is clean.
if [[ -n "$(find apps packages -type f -name '.env*' ! -name '.env.example' ! -path '*/node_modules/*' -print -quit)" ]] || \
   [[ -f .env || -f .env.local || -f .env.test || -f .env.development || -f .env.production ]]; then
  echo 'REFUSED: local application .env file detected. Use a clean, isolated qualification checkout.' >&2; exit 2
fi
for key in DATABASE_URL REDIS_URL PAYSTACK_SECRET_KEY PAYSTACK_PUBLIC_KEY MONNIFY_API_KEY MONNIFY_SECRET_KEY MONNIFY_CONTRACT_CODE MONNIFY_SOURCE_ACCOUNT_NUMBER VTPASS_API_KEY VTPASS_PUBLIC_KEY VTPASS_SECRET_KEY MONO_SECRET_KEY RESEND_API_KEY TERMII_API_KEY GOOGLE_CLIENT_SECRET TICKET_SIGNING_KEYS_JSON DATA_ENCRYPTION_KEY HIGH_RISK_FEATURES_RELEASE_QUALIFIED; do
  if [[ -n "${!key:-}" ]]; then
    echo "REFUSED: $key already exists in the shell. Use a clean terminal with no application/provider credentials." >&2; exit 2
  fi
done
if ! command -v openssl >/dev/null 2>&1; then echo 'BLOCKED: openssl required to generate random disposable credentials' >&2; exit 2; fi
export PHASE13_DB_PASSWORD="$(openssl rand -hex 24)"
export PHASE13_PG_PORT="${PHASE13_PG_PORT:-15435}"
export PHASE13_REDIS_PORT="${PHASE13_REDIS_PORT:-16382}"
export NODE_ENV=test
export HIGH_RISK_FEATURES_RELEASE_QUALIFIED=false OPENAPI_DOCS_ENABLED=false
export DATABASE_URL="postgresql://twipay_qualification:${PHASE13_DB_PASSWORD}@127.0.0.1:${PHASE13_PG_PORT}/twipay_qual_test?schema=public"
export REDIS_URL="redis://127.0.0.1:${PHASE13_REDIS_PORT}"
export WALLET_COLLECTIONS_SANDBOX_ENABLED=false BANK_TRANSFERS_SANDBOX_ENABLED=false
export VIRTUAL_ACCOUNTS_SANDBOX_ENABLED=false BILL_PURCHASES_SANDBOX_ENABLED=false
export EVENT_CHECKOUT_SANDBOX_ENABLED=false EVENT_TICKET_QR_SANDBOX_ENABLED=false
export VITE_TWIPAY_FUNDING_SANDBOX_ENABLED=false VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED=false
export VITE_TWIPAY_VIRTUAL_ACCOUNT_SANDBOX_ENABLED=false VITE_TWIPAY_BILLS_SANDBOX_ENABLED=false
export VITE_TWIPAY_EVENT_CHECKOUT_SANDBOX_ENABLED=false
export APP_URL=http://127.0.0.1:3000 ADMIN_URL=http://127.0.0.1:3001 API_URL=http://127.0.0.1:4000
export VITE_TWIPAY_API_URL="$API_URL"
export API_BIND_HOST=127.0.0.1
# Only disposable, random secrets for local read-only smoke; no real provider keys.
if [[ "$MODE" == --smoke ]]; then
  export SESSION_HASH_PEPPER="$(openssl rand -hex 32)"
  export MFA_RECOVERY_HMAC_KEY="$(openssl rand -hex 32)"
  export DATA_ENCRYPTION_KEY="$(openssl rand -base64 32 | tr -d '\n')"
  export PII_FINGERPRINT_KEY="$(openssl rand -hex 32)"
  export TICKET_SIGNING_KEYS_JSON="{\"1\":\"$(openssl rand -hex 32)\"}"
  export TICKET_SIGNING_CURRENT_VERSION=1
  export LOG_LEVEL=silent
fi
PROJECT="twipayqual$(date +%s)$$"
COMPOSE=(docker compose --project-name "$PROJECT" -f scripts/qualification/compose.phase1-3.yaml)
SERVICE_PIDS=()
cleanup() {
  for pid in "${SERVICE_PIDS[@]}"; do kill "$pid" >/dev/null 2>&1 || true; done
  for pid in "${SERVICE_PIDS[@]}"; do wait "$pid" >/dev/null 2>&1 || true; done
  "${COMPOSE[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT
# Refuse to overwrite occupied host ports. Compose itself will also reject any race.
node - <<'JS'
const net=require('node:net');
for (const value of [process.env.PHASE13_PG_PORT,process.env.PHASE13_REDIS_PORT]) {
 const port=Number(value);
 if(!Number.isInteger(port)||port<1024||port>65535) process.exit(2);
 const s=net.createServer();s.once('error',e=>{console.error(`REFUSED: qualification port ${port} is occupied`);process.exitCode=2});s.listen(port,'127.0.0.1',()=>s.close());
}
JS
pnpm install --frozen-lockfile
"${COMPOSE[@]}" up -d --wait
pgVersion="$("${COMPOSE[@]}" exec -T postgres psql -U twipay_qualification -d twipay_qual_test -Atqc 'SHOW server_version_num' | tr -d '\r')"
if [[ "$pgVersion" != 18* ]]; then echo 'FAIL: PostgreSQL 18 was not started' >&2; exit 1; fi
redisVersion="$("${COMPOSE[@]}" exec -T redis redis-cli INFO server | sed -n 's/^redis_version:\([^[:space:]]*\).*/\1/p' | tr -d '\r')"
if [[ "$redisVersion" != 8.* ]]; then echo 'FAIL: Redis 8 was not started' >&2; exit 1; fi
pnpm db:generate
pnpm --filter @twipay/database prisma:validate
pnpm --filter @twipay/database prisma:deploy
pnpm --filter @twipay/database test
pnpm --filter @twipay/worker test:integration
pnpm test:repo
pnpm test
pnpm test:phase1
pnpm test:phase1-3
pnpm typecheck
pnpm build
if [[ "$MODE" == --smoke ]]; then
  # Read-only browser journey, not provider testing. Refuse preexisting app ports.
  mkdir -p out
  node scripts/qualification/assert-loopback-ports-free.mjs 3000 3001 4000
  pnpm --filter @twipay/api start > out/phase15-api.log 2>&1 & SERVICE_PIDS+=("$!")
  pnpm --filter @twipay/worker start > out/phase15-worker.log 2>&1 & SERVICE_PIDS+=("$!")
  pnpm --filter @twipay/customer-ui preview > out/phase15-customer-ui.log 2>&1 & SERVICE_PIDS+=("$!")
  pnpm --filter @twipay/admin exec next start -H 127.0.0.1 -p 3001 > out/phase15-admin.log 2>&1 & SERVICE_PIDS+=("$!")
  node scripts/wait-for-stack.mjs
  kill -0 "${SERVICE_PIDS[1]}" || { echo 'FAIL: background reconciliation worker exited' >&2; exit 1; }
  pnpm e2e
  echo 'Phase 1.5 isolated stack and customer read-only browser smoke PASSED.'
  echo 'Phase 1.6 complete authorization, provider, concurrency and penetration gates remain outstanding.'
else
  echo 'Phase 1.3 local runtime gates PASSED. This does not qualify browser, provider or production gates.'
fi
