import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const ignored = new Set(['.git', 'node_modules', '.next', 'dist', 'coverage', '.test-dist']);
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (ignored.has(name)) continue;
    const p = join(dir, name); const s = statSync(p);
    if (s.isDirectory()) walk(p); else files.push(p);
  }
}
walk(root);
const textFiles = files.filter((f) => !/\.(png|jpg|jpeg|gif|webp|ico|zip)$/i.test(f));
const findings = [];
for (const file of textFiles) {
  const rel = relative(root, file);
  const text = readFileSync(file, 'utf8');
  const source = /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file) && !rel.startsWith('scripts/');
  if (source && /localStorage\.setItem\((['"])(accessToken|refreshToken|token|jwt|session)/i.test(text)) findings.push(`${rel}: auth token stored in localStorage`);
  if (source && /console\.(log|debug|info)\s*\(/.test(text)) findings.push(`${rel}: console logging prohibited in production source`);
  if (/sk_live_[A-Za-z0-9]/.test(text) || /sk_test_[A-Za-z0-9]/.test(text)) findings.push(`${rel}: looks like a payment secret key`);
  if (/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) findings.push(`${rel}: private key material`);
  if (rel === '.env') {
    try {
      execFileSync('git', ['ls-files', '--error-unmatch', '.env'], { stdio: 'pipe' });
      findings.push(`${rel}: .env must not be committed`);
    } catch {
      // .env is local-only and not tracked/committed
    }
  }
}

const envExample = readFileSync(join(root, '.env.example'), 'utf8');
for (const line of envExample.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const [name, ...rest] = trimmed.split('=');
  const value = rest.join('=');
  const secretLike = /(SECRET|PASSWORD|TOKEN|PRIVATE|DATABASE_URL|REDIS_URL|PEPPER|ENCRYPTION_KEY|API_KEY|SIGNING.*KEY)/.test(name);
  if (name.startsWith('NEXT_PUBLIC_') && secretLike) findings.push(`.env.example: secret-like variable exposed as ${name}`);
  if (secretLike && value && !['http://localhost:5432','http://localhost:6379'].includes(value)) findings.push(`.env.example: secret-like variable ${name} must be blank`);
}

if (findings.length) {
  console.error('Repository security check FAILED:\n' + findings.map((x) => ` - ${x}`).join('\n'));
  process.exit(1);
}
console.log(`Repository security check PASS (${textFiles.length} text files inspected)`);
