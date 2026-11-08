import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { adminRoutes, build, customerRoutes, deferredRoutes } from './build-matrix.mjs';

// Routes that legitimately have no row of their own, each with its reason.
const customerExempt = new Map([
  ['/auth', 'layout parent of the /auth/* pages'],
  ['/guide', 'dev-only documentation page (VITE_TWIPAY_DEV_GUIDE), not part of the product'],
  ['/dashboard/status', 'redirects to history (see C21)'],
]);

const here = dirname(fileURLToPath(import.meta.url));
const { rows } = build();

test('row ids are unique and every row has the fields the matrix needs', () => {
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length);
  for (const row of rows) {
    for (const key of ['id', 'app', 'feature', 'route', 'roles', 'proof', 'api']) assert.ok(row[key] !== undefined, `${row.id} lacks ${key}`);
    assert.ok(row.demonstrable === 'yes' || (row.demonstrable === 'no' && row.note), `${row.id} is not demonstrable without a reason`);
  }
});

test('every customer route in App.tsx has a row, is deferred by design, or is exempt with a reason', () => {
  const deferred = deferredRoutes();
  const covered = new Set(rows.filter((r) => r.app === 'customer').flatMap((r) => [r.route, ...(r.alsoRoutes ?? [])]));
  const missing = customerRoutes().filter((route) => !covered.has(route) && !customerExempt.has(route)
    && !deferred.some((d) => route === d || route.startsWith(`${d}/`) || route.replace(/^\/dashboard\/(flight|airline|hotel)\b/, '/dashboard/$1') === d));
  assert.deepEqual(missing, [], 'customer routes without a coverage row');
});

test('every admin page has a row', () => {
  const covered = new Set(rows.filter((r) => r.app === 'admin').map((r) => r.route));
  assert.deepEqual(adminRoutes().filter((route) => !covered.has(route)), [], 'admin pages without a coverage row');
});

test('admin rows use the permissions of the real nav, and every permission exists in the role snapshot', () => {
  const snapshot = JSON.parse(readFileSync(join(here, 'role-permissions.json'), 'utf8'));
  const known = new Set(Object.values(snapshot.roles).flat());
  const shell = readFileSync(join(here, '../../../apps/admin/app/_components/ops-shell.tsx'), 'utf8');
  const nav = new Map([...shell.matchAll(/href:\s*"([^"]+)"[^}]*?permission:\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));
  for (const row of rows.filter((r) => r.app === 'admin' && nav.has(r.route))) {
    assert.equal(row.permission, nav.get(row.route), `${row.id} ${row.route}: row permission differs from the nav`);
    if (row.permission && row.permission !== 'SUPER_ADMIN') assert.ok(known.has(row.permission), `${row.id}: unknown permission ${row.permission}`);
  }
  assert.ok(nav.size >= 15, 'the nav was not parsed');
});

test('no API route is left without a screen row or an explicit api-only row', () => {
  const { unassigned } = build();
  assert.deepEqual(unassigned.map((r) => `${r.method} ${r.path}`), [], 'API routes with no row: add a screen row or an api-only (R..) row');
});
