#!/usr/bin/env node
/**
 * Phase 2.6: read-only, manual-approval ORIGINAL ErhaPay vs TwiPay visual evidence.
 * Independent local React/Vite servers MUST be running. This program NEVER simulates
 * authenticated accounts, makes payments, or approves a visual baseline by itself.
 * Files are intentionally gitignored. Never point this at production or staging.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const output = resolve(repo, 'docs/tests/screenshots/phase2-reference');
function requiredLocalUrl(name) {
  const raw = process.env[name];
  if (!raw) throw new Error(`BLOCKED: ${name} must name an independently built local React/Vite server`);
  const url = new URL(raw);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.pathname !== '/' || url.search || url.hash || url.username || url.password)
    throw new Error(`BLOCKED: ${name} must be exactly http://127.0.0.1:<port>/`);
  return url;
}
const original = requiredLocalUrl('ERHAPAY_REFERENCE_URL');
const current = requiredLocalUrl('TWIPAY_CUSTOMER_URL');
if (original.origin === current.origin) throw new Error('BLOCKED: reference and TwiPay must have distinct local origins');

const { chromium } = await import('@playwright/test');
const browser = await chromium.launch({headless:true});
const matrix = [[1440,900],[1100,800],[1024,768],[768,1024],[390,844],[360,780],[844,390],[780,360]];
const paths = ['/', '/about', '/auth/login', '/auth/signup'];
const results=[];
try {
  mkdirSync(output,{recursive:true});
  for (const [width,height] of matrix) {
    for (const [label,url] of [['original',original],['twipay',current]]) {
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block',acceptDownloads:false});
      try {
        const page=await context.newPage();
        const errors=[];
        page.on('pageerror', error=>errors.push(error.message));
        // Do not touch external APIs, trackers or backend services; no seeded users.
        await page.route('**/*', route=>{
          const target=new URL(route.request().url());
          return target.origin===url.origin ? route.continue() : route.abort();
        });
        for (const path of paths) {
          const response=await page.goto(new URL(path,url).toString(),{waitUntil:'domcontentloaded'});
          if (response?.status() !== 200) throw new Error(`${label} ${path}: HTTP ${response?.status() ?? 'no response'}`);
          await page.locator('#root').waitFor({state:'attached'});
          if (path.startsWith('/auth/')) {
            await page.getByRole('textbox',{name:/email/i}).waitFor({state:'visible',timeout:15000});
            await page.locator('input[type="password"]').waitFor({state:'visible'});
          } else {
            await page.locator('body').waitFor({state:'visible'});
          }
          await page.evaluate(async()=>document.fonts.ready);
          const metadata=await page.evaluate(()=>({
            title:document.title,
            horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+2,
            rootTextLength:document.querySelector('#root')?.textContent?.trim().length??0,
            visibleHeading:[...document.querySelectorAll('h1,h2')].find(el=>el.getBoundingClientRect().width>0)?.textContent?.trim()??null,
          }));
          if (metadata.rootTextLength<8) throw new Error(`${label} ${path}: suspicious empty root; refusing to accept blank screenshots`);
          if (errors.length) throw new Error(`${label} ${path}: browser runtime error: ${errors.join(' / ')}`);
          const name=`${label}_${width}x${height}_${path.replaceAll('/','_')||'home'}.png`;
          await page.screenshot({path:resolve(output,name),fullPage:true,animations:'disabled'});
          results.push({label,width,height,path,file:name,...metadata});
        }
      } finally {await context.close();}
    }
  }
  const report={status:results.some(x=>x.horizontalOverflow)?'REVIEW_OVERFLOW':'CAPTURED_UNAPPROVED',
    warning:'Actual isolated local application screenshots, not automatic visual parity acceptance. No user data or transactions.',
    originalSource:'Unmodified original ErhaPay ZIP deployed separately',
    twipaySource:'Current consolidated apps/customer-ui',viewportCount:matrix.length,results};
  writeFileSync(resolve(output,'MANIFEST.json'),`${JSON.stringify(report,null,2)}\n`);
  if (report.status==='REVIEW_OVERFLOW') throw new Error('Visual evidence captured but horizontal overflow requires review');
  console.log(`CAPTURED ${results.length} public-only screenshots from two real local React apps; NOT visually approved`);
} finally {await browser.close();}
