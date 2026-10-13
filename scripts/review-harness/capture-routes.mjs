// Visits every static customer route (and optionally the admin pages) with a fresh verified throwaway account and
// writes one screenshot per route plus a findings table: console errors, page errors, failed API calls, and the
// visible buttons. Never submits forms: with PROBE_BUTTONS=1 it only clicks buttons whose label is on a safe list
// (open/view/close/cancel/menu/tab words) and closes any popup with Escape.
// Usage: SHOTS=docs/screenshots/<dated-folder>/routes node scripts/review-harness/capture-routes.mjs
import { session, emailCode, UI, API, PASSWORD } from './lib.mjs';
import { ADMIN } from './harness.mjs';
import { writeFileSync } from 'node:fs';

const SAFE =
  /^(open|view|show|close|cancel|back|menu|more|details?|filters?|tabs?|next|previous|learn more|copy)\b/i;
const customerRoutes = [
  '/',
  '/about',
  '/contact',
  '/faqs',
  '/privacy-policy',
  '/terms',
  '/auth/login',
  '/auth/signup',
  '/auth/reset-password',
  '/dashboard',
  '/dashboard/history',
  '/dashboard/transfer-funds',
  '/dashboard/withdraw-funds',
  '/dashboard/add-funds',
  '/dashboard/static-account',
  '/dashboard/services',
  '/dashboard/services/airtime',
  '/dashboard/services/data',
  '/dashboard/services/international-airtime',
  '/dashboard/services/international-data',
  '/dashboard/services/electricity',
  '/dashboard/services/cable',
  '/dashboard/services/epin',
  '/dashboard/services/esim',
  '/dashboard/services/mobile-money',
  '/dashboard/events',
  '/dashboard/book-flight',
  '/dashboard/hotels',
  '/dashboard/affiliate',
  '/dashboard/referral',
  '/dashboard/notifications',
  '/dashboard/status',
  '/dashboard/settings',
  '/dashboard/settings/account',
  '/dashboard/settings/identity-verification',
  '/dashboard/settings/security',
  '/dashboard/settings/bank-info',
  '/dashboard/settings/support',
  '/dashboard/settings/faqs',
  '/dashboard/settings/security-overview',
  '/dashboard/settings/beneficiaries',
  '/dashboard/settings/notification-preferences',
  '/dashboard/settings/support-centre',
  '/dashboard/my-tickets',
  '/dashboard/organizer',
  '/dashboard/event-check-in',
  '/dashboard/virtual-card',
  '/dashboard/virtual-card/details',
  '/dashboard/virtual-card/fund',
  '/dashboard/virtual-card/withdraw',
  '/receipt',
];
const adminRoutes = [
  '/login',
  '/',
  '/audit',
  '/compliance',
  '/config',
  '/exceptions',
  '/financial-tiers',
  '/notifications',
  '/owner',
  '/owner/customers',
  '/owner/staff',
  '/payouts',
  '/providers',
  '/refunds',
  '/reports',
  '/security',
  '/support',
];

const email = `qa.routes.${Date.now()}@example.test`;
const { browser, page, cookies } = await session();
const rows = [];

async function register() {
  const t0 = Date.now() - 2000;
  await page.goto(`${UI}/auth/signup`, { waitUntil: 'networkidle' });
  for (const [k, v] of Object.entries({
    firstname: 'Qa',
    lastname: 'Routes',
    email,
    password: PASSWORD,
  }))
    await page.fill(`#${k}`, v);
  await page.click('button:has-text("Create account")');
  const mail = await emailCode(email, { since: t0 });
  if (!mail) throw new Error('verification email not received');
  await page.fill('input', mail.code);
  await page.click('button:has-text("Verify and continue")');
  await page.waitForTimeout(3500);
}

async function visit(base, route, prefix) {
  const problems = [];
  const onResponse = (r) => {
    if (r.url().startsWith(`${API}/v1/`) && r.status() >= 400)
      problems.push(`${r.status()} ${r.request().method()} ${r.url().replace(API, '')}`);
  };
  const onConsole = (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
      problems.push(`console: ${m.text().slice(0, 120)}`);
  };
  const onError = (e) => problems.push(`pageerror: ${String(e).slice(0, 120)}`);
  page.on('response', onResponse);
  page.on('console', onConsole);
  page.on('pageerror', onError);
  try {
    await page.goto(base + route, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const buttons = await page.$$eval('button, [role=button], a[href]', (els) =>
      els
        .filter((e) => e.offsetParent)
        .map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim())
        .filter(Boolean)
        .slice(0, 40),
    );
    if (process.env.PROBE_BUTTONS === '1') {
      for (const label of [...new Set(buttons)].filter((l) => SAFE.test(l)).slice(0, 5)) {
        await page
          .getByRole('button', { name: label })
          .first()
          .click({ timeout: 1500 })
          .catch(() => {});
        await page.keyboard.press('Escape');
      }
    }
    const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/\W+/g, '-');
    const shot = `${process.env.SHOTS || 'docs/screenshots/review-output'}/${prefix}-${slug}.png`;
    await page.screenshot({ path: shot, fullPage: true });
    rows.push({
      route: prefix + route,
      landed: page.url().replace(base, '') || '/',
      problems,
      buttons: buttons.length,
      shot,
    });
  } finally {
    page.off('response', onResponse);
    page.off('console', onConsole);
    page.off('pageerror', onError);
  }
}

for (const route of customerRoutes.filter(
  (r) => r.startsWith('/auth') || (!r.startsWith('/dashboard') && r !== '/receipt'),
))
  await visit(UI, route, 'ui');
await register();
console.log('cookies:', (await cookies()).length);
for (const route of customerRoutes.filter((r) => r.startsWith('/dashboard') || r === '/receipt'))
  await visit(UI, route, 'ui');
if (process.env.INCLUDE_ADMIN === '1')
  for (const route of adminRoutes) await visit(ADMIN, route, 'admin');

const md = [
  '| Route | Landed on | Buttons/links | Problems |',
  '| :--- | :--- | ---: | :--- |',
  ...rows.map(
    (r) => `| ${r.route} | ${r.landed} | ${r.buttons} | ${r.problems.join('<br>') || '-'} |`,
  ),
].join('\n');
writeFileSync(`${process.env.SHOTS || 'docs/screenshots/review-output'}/ROUTES.md`, `${md}\n`);
console.log(md);
await browser.close();
