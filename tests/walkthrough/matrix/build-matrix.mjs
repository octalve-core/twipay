// Computes the coverage matrix from the code and the curated rows (rows.json). Usage:
//   node tests/walkthrough/matrix/build-matrix.mjs [--out <dir>] [--strict]
// Statuses come from <out>/timeline.json (a step's `covers` ticks a row); nothing is ticked by hand.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

export function customerRoutes() {
  const lines = read('apps/customer-ui/src/App.tsx').split('\n');
  const found = [];
  const stack = [];
  let depth = 0;
  let last = '';
  for (const line of lines) {
    const pathMatch = line.match(/\bpath:\s*"([^"]*)"/);
    if (pathMatch) {
      const p = pathMatch[1];
      const parent = stack.at(-1)?.prefix ?? '';
      last = p.startsWith('/') || p === '*' ? p : `${parent}/${p}`.replace(/\/+/g, '/');
      found.push(last);
    }
    const opens = (line.match(/\[/g) ?? []).length;
    const closes = (line.match(/\]/g) ?? []).length;
    if (/children:\s*\[/.test(line)) stack.push({ prefix: last, depth: depth + 1 });
    depth += opens - closes;
    while (stack.length && depth < stack.at(-1).depth) stack.pop();
  }
  return [...new Set(found)];
}

export function adminRoutes() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name === 'page.tsx') out.push(`/${relative(join(root, 'apps/admin/app'), dirname(path)).replaceAll('\\', '/')}`.replace(/\/\.$/, '/').replace(/^\/$/, '/'));
    }
  };
  walk(join(root, 'apps/admin/app'));
  return out.map((r) => (r === '' ? '/' : r === '/.' ? '/' : r)).sort();
}

export function deferredRoutes() {
  const text = read('apps/customer-ui/src/lib/constants.ts');
  const block = text.match(/futureProductRoutes\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? '';
  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

export function apiRoutes() {
  const routes = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.controller.ts')) {
        const src = readFileSync(path, 'utf8');
        const prefix = src.match(/@Controller\(\s*['"]([^'"]*)['"]/)?.[1] ?? '';
        for (const m of src.matchAll(/@(Get|Post|Patch|Put|Delete)\(\s*(?:['"]([^'"]*)['"])?\s*\)/g)) {
          const full = `/${prefix}/${m[2] ?? ''}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
          routes.push({ method: m[1].toUpperCase(), path: full, file: relative(root, path) });
        }
      }
    }
  };
  walk(join(root, 'apps/api/src/modules'));
  return routes;
}

export function apiMatches(pattern, route) {
  const parts = pattern.split(' ');
  const method = parts.length > 1 ? parts[0] : '*';
  const glob = parts.at(-1);
  if (method !== '*' && method !== route.method) return false;
  const re = new RegExp(`^${glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return re.test(route.path);
}

export function rolesFor(row, perms) {
  if (row.permission === undefined || !Array.isArray(row.roles) || row.roles[0] !== 'by-permission') return row.roles;
  if (row.permission === 'SUPER_ADMIN') return ['SUPER_ADMIN'];
  return Object.entries(perms.roles).filter(([, list]) => list.includes(row.permission)).map(([code]) => code);
}

export function build({ outDir = null } = {}) {
  const rows = JSON.parse(read('tests/walkthrough/matrix/rows.json'));
  const perms = JSON.parse(read('tests/walkthrough/matrix/role-permissions.json'));
  const timelinePath = outDir ? join(outDir, 'timeline.json') : null;
  const timeline = timelinePath && existsSync(timelinePath) ? JSON.parse(readFileSync(timelinePath, 'utf8')) : [];
  const ticked = new Set(timeline.flatMap((s) => s.covers ?? []));
  const api = apiRoutes();
  const unassigned = api.filter((route) => !rows.some((row) => row.api.some((p) => apiMatches(p, route))));
  const status = (row) => (row.demonstrable === 'no' ? 'not demonstrable' : ticked.has(row.id) ? 'ticked' : 'planned');
  const md = [
    '# Coverage matrix', '',
    '| ID | App | Feature | Route | Roles that can reach it | The click that proves it | API behind it | Gated by | Status |',
    '| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |',
    ...rows.map((row) => `| ${row.id} | ${row.app} | ${row.feature} | \`${row.route}\` | ${rolesFor(row, perms).join(', ')} | ${row.demonstrable === 'no' ? row.note : row.proof} | ${row.api.join('<br>') || '-'} | ${row.gatedBy ?? '-'} | ${status(row)} |`),
    '', '## Not demonstrable here',
    ...rows.filter((r) => r.demonstrable === 'no').map((r) => `- **${r.id} ${r.feature}**: ${r.note}`),
    '', `## API routes with no screen row (${unassigned.length} of ${api.length}) - triage these in recon`,
    ...unassigned.map((r) => `- ${r.method} ${r.path} (${r.file})`),
  ].join('\n');
  const planned = rows.filter((row) => status(row) === 'planned');
  return { rows, md, planned, unassigned, api };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outIndex = process.argv.indexOf('--out');
  const outDir = outIndex > 0 ? process.argv[outIndex + 1] : null;
  const { md, planned } = build({ outDir });
  if (outDir) { mkdirSync(outDir, { recursive: true }); writeFileSync(join(outDir, 'coverage-matrix.md'), `${md}\n`); }
  else process.stdout.write(`${md}\n`);
  if (process.argv.includes('--strict') && planned.length) {
    process.stderr.write(`coverage: ${planned.length} rows still planned: ${planned.map((r) => r.id).join(', ')}\n`);
    process.exit(1);
  }
}
