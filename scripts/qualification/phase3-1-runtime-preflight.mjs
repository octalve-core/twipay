#!/usr/bin/env node
/**
 * Read-only, fail-closed Phase 3.1 runtime preflight.
 * Never connects to provider APIs, runs migrations, prints credentials,
 * invokes external package installers or mutates database state.
 * A reachable TCP socket does NOT imply successful database/Redis integration.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const checks = [];
const add = (id, ok, detail) => checks.push({ id, status: ok ? 'READY_FOR_NEXT_GATE' : 'BLOCKED', detail });
const expected = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const git = args => { try { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 3000 }).trim(); } catch { return null; } };
const executeVersion = command => {
  try {
    const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 2500 });
    return result.status === 0 ? `${result.stdout.trim() || result.stderr.trim()}` : null;
  } catch { return null; }
};
const localSocket = (port, host = '127.0.0.1') => new Promise(resolve => {
  const socket = net.createConnection({ host, port });
  let done = false;
  const finish = status => { if (done) return; done = true; socket.destroy(); resolve(status); };
  socket.setTimeout(750, () => finish(false));
  socket.on('connect', () => finish(true));
  socket.on('error', () => finish(false));
});
const sha = git(['rev-parse', 'HEAD']);
const branch = git(['branch', '--show-current']);
const dirty = git(['status', '--porcelain']);
add('git-embedded-history', Boolean(sha && branch && dirty !== null), sha && branch ? `HEAD ${sha} on ${branch}` : 'Git checkpoint unavailable');
add('git-clean-working-tree', dirty === '', dirty === '' ? 'clean' : 'Uncommitted paths exist or Git unavailable');
const nodeVersion = process.versions.node;
add('node-24', nodeVersion.split('.')[0] === '24', `available ${nodeVersion}; required Node 24`);
const pnpmVersion = executeVersion('pnpm');
const wantedPnpm = expected.packageManager.split('@').at(-1);
add('pinned-pnpm', pnpmVersion === wantedPnpm, `required pnpm ${wantedPnpm}; available ${pnpmVersion ?? 'not installed'}`);
const lockfile = existsSync(resolve(root, 'pnpm-lock.yaml'));
add('authentic-frozen-lockfile', lockfile, lockfile ? 'lockfile present; frozen install must still be run' : 'pnpm-lock.yaml absent; frozen workspace installation cannot be verified');
const pgPort = Number(process.env.POSTGRES_PORT || 5435);
const redisPort = Number(process.env.REDIS_PORT || 6382);
const pgReachable = await localSocket(pgPort);
const redisReachable = await localSocket(redisPort);
add('postgres18-local-reachability', pgReachable, `loopback port ${pgPort} ${pgReachable ? 'accepts TCP; version/auth/migrations unverified' : 'unreachable'}`);
add('redis8-local-reachability', redisReachable, `loopback port ${redisPort} ${redisReachable ? 'accepts TCP; version/auth/distributed tests unverified' : 'unreachable'}`);
add('prisma7-cli-install', existsSync(resolve(root, 'node_modules', '.bin', 'prisma')) || existsSync(resolve(root, 'packages', 'database', 'node_modules', '.bin', 'prisma')), (existsSync(resolve(root, 'node_modules', '.bin', 'prisma')) || existsSync(resolve(root, 'packages', 'database', 'node_modules', '.bin', 'prisma'))) ? 'CLI present; command not yet validated or executed' : 'Prisma CLI absent; database generate/validate/migrate not executable' );
const canSendSandbox = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM && process.env.TWIPAY_TEST_EMAIL_INBOX);
add('resend-controlled-inbox', canSendSandbox, canSendSandbox ? 'configuration present; actual email send/delivery/bounce is unverified' : 'requires RESEND_API_KEY, RESEND_FROM, TWIPAY_TEST_EMAIL_INBOX; no message sent');
const summary = {
  type: 'TWIPAY_PHASE_3_1_READ_ONLY_RUNTIME_PREFLIGHT',
  timestamp: new Date().toISOString(),
  source: 'actual repository working tree',
  qualification: 'NOT_RUN_OR_NOT_QUALIFIED',
  passedPrerequisites: checks.filter(c => c.status === 'READY_FOR_NEXT_GATE').length,
  blockedPrerequisites: checks.filter(c => c.status === 'BLOCKED').length,
  checks,
  warnings: [
    'TCP reachability is not PostgreSQL/Redis schema, version, transaction or concurrency verification.',
    'No real email is sent; no sandbox delivery claim may be made.',
    'This preflight never runs real HTTP, Prisma migrations, or builds.',
    'Never use production customer data or production database credentials for qualification.',
  ],
};
const json = `${JSON.stringify(summary, null, 2)}\n`;
if (process.env.TWIPAY_PREFLIGHT_REPORT_PATH) {
  const location = resolve(process.env.TWIPAY_PREFLIGHT_REPORT_PATH);
  mkdirSync(dirname(location), { recursive: true });
  writeFileSync(location, json, { flag: 'w' });
}
process.stdout.write(json);
process.exitCode = checks.every(c => c.status === 'READY_FOR_NEXT_GATE') ? 0 : 2;
