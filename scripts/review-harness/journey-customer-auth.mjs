// Sign-up -> email verification -> dashboard, with a wrong code first. Creates a fresh throwaway account.
// Usage: SHOTS=docs/screenshots/<dated-folder> node scripts/review-harness/journey-customer-auth.mjs
import { session, emailCode, UI, PASSWORD } from './lib.mjs';

const email = `qa.${Date.now()}@example.test`;
console.log('test user:', email);
const { browser, page, step, cookies, consoleErrors } = await session();
const fillSignup = async (v) => {
  for (const [k, val] of Object.entries(v)) await page.fill(`#${k}`, val);
  await page.click('button:has-text("Create account")');
};

await step('signup page loads', () => page.goto(`${UI}/auth/signup`, { waitUntil: 'networkidle' }));
await step('signup empty submit', () => page.click('button:has-text("Create account")'));
await step('signup short password', () =>
  fillSignup({ firstname: 'Qa', lastname: 'Tester', email, password: 'short1' }),
);
await page.reload({ waitUntil: 'networkidle' });
await step('signup invalid email', () =>
  fillSignup({ firstname: 'Qa', lastname: 'Tester', email: 'not-an-email', password: PASSWORD }),
);
await page.reload({ waitUntil: 'networkidle' });
const t0 = Date.now() - 2000;
await step(
  'signup valid',
  () => fillSignup({ firstname: 'Qa', lastname: 'Tester', email, password: PASSWORD }),
  { wait: 3500 },
);
console.log(`\ncookies after signup:\n  ${(await cookies()).join('\n  ')}`);

const mail = await emailCode(email, { since: t0 });
console.log('\nverification email:', mail ? `${mail.subject} | code ${mail.code}` : 'NOT RECEIVED');
await step('verify wrong code', async () => {
  await page.fill('input', '000000').catch(() => {});
  await page.click('button:has-text("Verify and continue")').catch(() => {});
});
await step(
  'verify correct code',
  async () => {
    await page.fill('input', mail?.code ?? '');
    await page.click('button:has-text("Verify and continue")');
  },
  { wait: 3500 },
);
await step('reload dashboard session persists', () => page.reload({ waitUntil: 'networkidle' }), {
  wait: 2500,
});
console.log(
  `\nconsole errors: ${consoleErrors.length ? `\n  ${consoleErrors.join('\n  ')}` : 'none'}`,
);
await browser.close();
