#!/usr/bin/env node
/**
 * Optional Phase 2 source-visual comparison evidence, NOT an automated visual approval.
 * Run ONLY with two independently built, unmodified LOCAL apps: original ErhaPay
 * reference and consolidated TwiPay customer UI. No logins, payments, or clicks.
 * Screenshots remain untracked and must be reviewed manually before approval.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const output = resolve(repo, 'docs/tests/screenshots/phase2-reference');
function requiredLocalUrl(name) {
  const raw = process.env[name];
  if (!raw) throw new Error(`BLOCKED: ${name} must point to a separate local, isolated reference server`);
  const url = new URL(raw);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.pathname !== '/' || url.search || url.hash)
    throw new Error(`BLOCKED: ${name} must be exactly http://127.0.0.1:<port>/`);
  return url;
}
const original=requiredLocalUrl('ERHAPAY_REFERENCE_URL');
const current=requiredLocalUrl('TWIPAY_CUSTOMER_URL');
if (original.origin === current.origin) throw new Error('BLOCKED: original and current must use distinct local servers');

// Do not require Playwright until configuration is validated.
const { chromium } = await import('@playwright/test');
const browser = await chromium.launch({headless:true});
const matrix = [[1440,900],[1100,800],[1024,768],[768,1024],[390,844],[360,780],[844,390],[780,360]];
const paths = ['/', '/about', '/auth/login','/auth/signup'];
const results=[];
try {
  mkdirSync(output,{recursive:true});
  for (const [width,height] of matrix) {
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
    try {
      for (const [label,url] of [['original',original],['twipay',current]]) {
        const page=await context.newPage();
        // Refuse third-party networks and cross-origin requests, including legacy SDK APIs.
        await page.route('**/*', route=>{
          const target=new URL(route.request().url());
          return target.origin===url.origin ? route.continue() : route.abort();
        });
        for (const path of paths) {
          const response=await page.goto(new URL(path,url).toString(),{waitUntil:'domcontentloaded'});
          if (response?.status() !== 200) throw new Error(`${label} ${path} returned ${response?.status() ?? 'no response'}`);
          await page.locator('body').waitFor({state:'visible'});
          await page.evaluate(()=>document.fonts.ready);
          const name=`${label}_${width}x${height}_${path.replaceAll('/','_')||'home'}.png`;
          await page.screenshot({path:resolve(output,name),fullPage:true,animations:'disabled'});
          const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
          results.push({label,width,height,path,file:name,horizontalOverflow:overflow});
        }
        await page.close();
      }
    } finally {await context.close();}
  }
  writeFileSync(resolve(output,'MANIFEST.json'),`${JSON.stringify({note:'Read-only unapproved screenshots. Manual visual parity review is required.',results},null,2)}\n`);
  if (results.some(x=>x.horizontalOverflow)) throw new Error('SCREENSHOTS_CAPTURED_WITH_OVERFLOW: inspect MANIFEST.json before approval');
  console.log(`CAPTURED ${results.length} local-only screenshots; NOT visually approved`);
} finally {await browser.close();}
