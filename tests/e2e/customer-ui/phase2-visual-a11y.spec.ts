import { test, expect } from '@playwright/test';

/** Real-browser, anonymous-only checks. Run only against apps/customer-ui (ErhaPay/Vite). */
const matrix = [
  [1440,900], [1100,800], [1024,768], [768,1024],
  [390,844], [360,780], [844,390], [780,360],
] as const;

for (const [width,height] of matrix) {
  test(`Phase 2.6 public auth visual accessibility ${width}x${height}`, async ({page}) => {
    await page.setViewportSize({width,height});
    const runtimeErrors:string[]=[];
    page.on('pageerror', e => runtimeErrors.push(e.message));
    await page.goto('/auth/login',{waitUntil:'domcontentloaded'});
    await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
    await expect(page.getByRole('textbox',{name:'Email'})).toBeVisible();
    await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
    expect(overflow,'No unintended horizontal scrolling').toBe(false);
    await page.getByRole('button',{name:'Show password'}).focus();
    await expect(page.getByRole('button',{name:'Show password'})).toBeFocused();
    expect(runtimeErrors).toEqual([]);
  });
}
