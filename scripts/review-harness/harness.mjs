// Browser harness for manual/AI-driven UI reviews. Not part of CI.
//
// Two modes:
//   direct (default)  REVIEW_UI / REVIEW_ADMIN / REVIEW_API point at URLs the browser can reach, e.g. the localhost ports.
//   intercept         set REVIEW_PUBLIC_HOST=<host> to make the browser believe the stack lives at the public
//                     https origins (443 -> UI, 8443 -> admin, 10000 -> API) while Playwright serves them from
//                     localhost inside the browser. No sockets are opened. Use it when the front ends were built
//                     with public origins baked in (see docs/development/docker-stack.md).
import { chromium } from '@playwright/test';

const env = process.env;
export const PUBLIC_HOST = env.REVIEW_PUBLIC_HOST || '';
export const UI = PUBLIC_HOST ? `https://${PUBLIC_HOST}` : env.REVIEW_UI || 'http://localhost:3002';
export const ADMIN = PUBLIC_HOST ? `https://${PUBLIC_HOST}:8443` : env.REVIEW_ADMIN || 'http://localhost:3001';
export const API = PUBLIC_HOST ? `https://${PUBLIC_HOST}:10000` : env.REVIEW_API || 'http://localhost:4000';
export const MAIL = env.REVIEW_MAIL || 'http://127.0.0.1:8025';

const LOCAL = { '': 3002, 8443: 3001, 10000: 4000 };

export async function launch() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (PUBLIC_HOST) {
    const pattern = new RegExp(`^https://${PUBLIC_HOST.replace(/\./g, '\\.')}(:\\d+)?/`);
    await context.route(pattern, async (route) => {
      const url = new URL(route.request().url());
      const port = LOCAL[url.port];
      if (!port) return route.abort();
      const headers = { ...route.request().headers(), host: url.host, 'x-forwarded-proto': 'https', 'x-forwarded-host': url.host };
      const response = await route.fetch({ url: `http://127.0.0.1:${port}${url.pathname}${url.search}`, headers, maxRedirects: 0 });
      await route.fulfill({ response });
    });
  }
  return { browser, context };
}
