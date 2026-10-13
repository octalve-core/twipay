import { launch, UI, API, MAIL } from './harness.mjs';
import { mkdirSync } from 'node:fs';

export { UI, API };
export const PASSWORD = 'Correct-Horse-Battery-9';
export const SHOTS = process.env.SHOTS || 'docs/screenshots/review-output';

// One browser session. step(name, fn) runs fn, waits, records the API calls it caused and any visible error text,
// then saves a numbered screenshot into SHOTS.
export async function session() {
  mkdirSync(SHOTS, { recursive: true });
  const { browser, context } = await launch();
  const page = await context.newPage();
  let net = [];
  const pending = [];
  page.on('response', (r) => {
    if (!r.url().startsWith(`${API}/v1/`)) return;
    pending.push((async () => {
      let body = '';
      try { body = JSON.stringify(await r.json()); } catch { body = ''; }
      body = body.replace(/("(?:csrfToken|token|accessToken)":")[^"]+/g, '$1<redacted>').slice(0, 150);
      net.push(`${r.status()} ${r.request().method()} ${r.url().replace(API, '')} ${body}`);
    })());
  });
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) consoleErrors.push(m.text().slice(0, 140));
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 140)}`));

  let n = 0;
  async function step(name, fn, { wait = 1800 } = {}) {
    net = [];
    pending.length = 0;
    await fn();
    await page.waitForTimeout(wait);
    await Promise.all(pending);
    const texts = await page.evaluate(() => {
      const found = new Set();
      const sel = '[role=alert],[role=status],[data-sonner-toast],.toast,[class*=error],[class*=Error],p,span,div';
      for (const el of document.querySelectorAll(sel)) {
        if (el.children.length > 2) continue;
        const t = (el.innerText || '').trim();
        if (t && t.length < 160 && /error|invalid|incorrect|required|already|must|failed|wrong|unable|too |denied|not |expired|try again|min|characters|match/i.test(t)) found.add(t.replace(/\s+/g, ' '));
      }
      return [...found].slice(0, 6);
    });
    n += 1;
    const file = `${SHOTS}/${String(n).padStart(2, '0')}-${name.replace(/\W+/g, '-').toLowerCase()}.png`;
    await page.screenshot({ path: file });
    console.log(`\n[${n}] ${name}\n    url:  ${page.url().replace(UI, '')}\n    api:  ${net.length ? net.join('\n          ') : '(none)'}\n    ui:   ${texts.join(' | ') || '(no message found)'}\n    shot: ${file}`);
  }
  const cookies = async () => (await context.cookies()).map((c) => `${c.name} [${c.domain}${c.path}] httpOnly=${c.httpOnly} secure=${c.secure} sameSite=${c.sameSite} ${c.expires > 0 ? 'persistent' : 'session'}`);
  return { browser, context, page, step, cookies, consoleErrors };
}

// Reads the newest dev-inbox message for `to` received after `since` (ms epoch) and extracts a 6-8 digit code.
export async function emailCode(to, { pattern = /\b\d{6,8}\b/, since = 0, timeoutMs = 20000 } = {}) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const msgs = await (await fetch(`${MAIL}/api/messages`)).json();
    const m = msgs.find((x) => x.to.includes(to) && Date.parse(x.receivedAt) >= since);
    if (m) return { code: (m.text.match(pattern) || [])[0], subject: m.subject, text: m.text };
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}
