import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/** Non-financial anonymous visual smoke baseline for the ORIGINAL ErhaPay-derived TwiPay UI.
 * Invoke with APP_URL pointed at the Vite customer app, not the deprecated Next.js app.
 * This suite is deliberately read-only and captures every requested viewport.
 */
const matrix = [
  [1440,900], [1100,800], [1024,768], [768,1024],
  [390,844], [360,780], [844,390], [780,360],
] as const;

for (const [width,height] of matrix) {
  test(`Batch F anonymous login visual baseline ${width}x${height}`, async ({page}) => {
    await page.setViewportSize({width,height});
    const consoleErrors: string[] = [];
    page.on('pageerror', error => consoleErrors.push(error.message));
    await page.goto('/auth/login', {waitUntil:'domcontentloaded'});
    await expect(page.getByLabel('Email', {exact:true})).toBeVisible();
    await expect(page.getByLabel('Password', {exact:true})).toBeVisible();
    const horizontalOverflow=await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(horizontalOverflow, `Unexpected horizontal overflow at ${width}x${height}`).toBe(false);
    expect(consoleErrors).toEqual([]);
    mkdirSync('docs/tests/screenshots/anonymous', {recursive:true});
    await page.screenshot({path:`docs/tests/screenshots/anonymous/000_${width}x${height}_login_initial.png`,fullPage:true});
  });
}
