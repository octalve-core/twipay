#!/usr/bin/env bash
# Only for an authorized local qualification workstation with Node 24, exact pnpm, Docker.
# A disposable database and Redis are created; all financial/provider flags remain OFF.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
MODE="${1:-}"
if [[ "$MODE" != --prepare-lock && "$MODE" != --qualify ]]; then
  echo 'Usage: scripts/qualification/phase1-3-run-local.sh --prepare-lock|--qualify' >&2; exit 2
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
PROJECT="twipayqual$(date +%s)$$"
COMPOSE=(docker compose --project-name "$PROJECT" -f scripts/qualification/compose.phase1-3.yaml)
cleanup() { "${COMPOSE[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true; }
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
echo 'Phase 1.3 local runtime gates PASSED. This does not qualify browser, provider or production gates.'
