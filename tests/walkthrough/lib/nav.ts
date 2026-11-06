import type { Page } from '@playwright/test';

// The only way the journey may load a URL, and only once per tab (the first load). Every later navigation is a click.
const used = new WeakSet<Page>();

export async function firstLoad(page: Page, url: string): Promise<void> {
  if (used.has(page)) throw new Error(`WALKTHROUGH_RULE: goto was already used on this tab, navigate by clicking (${url})`);
  used.add(page);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}
