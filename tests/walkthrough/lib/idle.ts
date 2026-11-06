// Deliberate waits the journey cannot avoid: the sign-in rate limit (a product policy) and the next one-time-code step. They are
// waited out by the clock, never by what the app shows, and recorded here so the video builder can cut them out: a very fast person
// would not sit idle, and nothing happens on screen during them.
import type { Page } from '@playwright/test';

export const idleSpans: Array<{ from: number; to: number }> = [];

export async function idleWait(page: Pick<Page, 'waitForTimeout'>, ms: number): Promise<void> {
  const from = Date.now();
  await page.waitForTimeout(ms);
  idleSpans.push({ from, to: Date.now() });
}
