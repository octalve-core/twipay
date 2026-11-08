// Brings the isolated walkthrough stack up from nothing: writes a git-ignored env file with fresh secrets, builds, starts,
// proves the database is the empty walkthrough one. Prints every command it runs. Writes no application data.
//   node tests/walkthrough/stage.mjs up | down | status
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const out = join(root, 'out', 'walkthrough');
const envFile = join(out, 'stage.env');
const compose = join(here, 'compose.walkthrough.yaml');
const ports = { WT_UI_PORT: '3102', WT_ADMIN_PORT: '3101', WT_API_PORT: '4100', WT_MAIL_PORT: '8125', WT_PG_PORT: '5436', WT_REDIS_PORT: '6383' };
const hex = (n = 32) => randomBytes(n).toString('hex');

function run(command, args, options = {}) {
  process.stdout.write(`$ ${command} ${args.join(' ')}\n`);
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: root, ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function freePortsOrExit() {
  for (const [name, port] of Object.entries(ports)) {
    const busy = execFileSync('sh', ['-c', `ss -ltn | grep -c ":${port} " || true`], { encoding: 'utf8' }).trim() !== '0';
    if (busy && process.argv[2] === 'up') { process.stderr.write(`port ${port} (${name}) is busy; free it or change it in stage.mjs\n`); process.exit(2); }
  }
}

const action = process.argv[2];
const env = { ...process.env, ...ports, WT_ENV_FILE: envFile };
const base = ['compose', '-p', 'twipay-wt', '-f', compose];

if (action === 'up') {
  mkdirSync(out, { recursive: true });
  // A fresh run writes new secrets; `up` again (e.g. after a compose change) reuses them so existing data still decrypts.
  const reuse = existsSync(envFile) && !process.argv.includes('--fresh');
  const pgPassword = reuse ? readFileSync(envFile, 'utf8').match(/^WT_PG_PASSWORD=(.*)$/m)[1] : hex(16);
  env.WT_PG_PASSWORD = pgPassword;
  if (!reuse) freePortsOrExit(); // a re-run of `up` finds its own containers on the ports
  if (!reuse) writeFileSync(envFile, [
    `WT_PG_PASSWORD=${pgPassword}`,
    `SESSION_HASH_PEPPER=${hex()}`, `MFA_RECOVERY_HMAC_KEY=${hex()}`, `PII_FINGERPRINT_KEY=${hex()}`, `TRANSACTION_PIN_PEPPER=${hex()}`,
    `DATA_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`,
    `TICKET_SIGNING_KEYS_JSON={"1":"${hex(24)}"}`, 'TICKET_SIGNING_CURRENT_VERSION=1',
    'HIGH_RISK_FEATURES_RELEASE_QUALIFIED=false', 'MFA_TOTP_ISSUER=TwiPay', 'LOG_LEVEL=warn',
  ].join('\n') + '\n', { mode: 0o600 });
  // Rate limit note: login/registration share 10 per minute per IP and the limiter is in memory; a fresh API per run resets it.
  run('docker', [...base, 'up', '-d', '--build'], { env });
  const name = execFileSync('docker', ['exec', 'twipay-wt-postgres-1', 'psql', '-U', 'wt', '-d', 'wip_twipay_walkthrough', '-tAc', 'select current_database()'], { encoding: 'utf8' }).trim();
  const users = execFileSync('docker', ['exec', 'twipay-wt-postgres-1', 'psql', '-U', 'wt', '-d', 'wip_twipay_walkthrough', '-tAc', 'select count(*) from users'], { encoding: 'utf8' }).trim();
  if (name !== 'wip_twipay_walkthrough' || (!reuse && users !== '0')) { process.stderr.write(`start state wrong: database ${name}, users ${users}\n`); process.exit(3); }
  process.stdout.write(`stage ok: ${name}, ${users} users, UI http://localhost:${ports.WT_UI_PORT}, admin :${ports.WT_ADMIN_PORT}, mail sink :${ports.WT_MAIL_PORT}\n`);
} else if (action === 'down') {
  run('docker', [...base, 'down', '-v', '--remove-orphans'], { env: { ...env, WT_PG_PASSWORD: 'unused' } });
} else if (action === 'status') {
  run('docker', [...base, 'ps'], { env: { ...env, WT_PG_PASSWORD: 'unused' } });
} else {
  process.stderr.write('usage: node tests/walkthrough/stage.mjs up|down|status\n');
  process.exit(2);
}
