#!/usr/bin/env node
/** Fail closed if prohibited betting implementations enter TwiPay's active application/bundle. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const source=join(root,'apps/customer-ui/src');
const bundle=join(root,'apps/customer-ui/dist');
const built=process.argv.includes('--built');
function files(dir) {return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}
const forbiddenSource=[
  /(?:from|import\()\s*["'][^"']*(?:\/services\/betting\/|useBettingStore)/i,
  /(?:fetchBettingProviders|verifyBettingWalletNumber|fundBettingWallet|BettingServiceFormSchema)/,
  /href:\s*["']\/dashboard\/services\/betting["']/,
];
const forbiddenBundle=[/betting-providers/i,/fundBettingWallet/,/fetchBettingProviders/,/verifyBettingWalletNumber/,/Fund betting/i, /\/betting\/verify/i];
const violations=[];
for (const path of files(source).filter(p=>/\.(?:tsx?|jsx?|css)$/.test(p))) {
  const code=readFileSync(path,'utf8');
  for (const pattern of forbiddenSource) if (pattern.test(code)) violations.push(`${path}: ${pattern}`);
}
if (built) {
  if (!existsSync(join(bundle,'index.html'))) throw Error('Missing actual customer Vite production build; bundle certification cannot be claimed');
  for (const path of files(bundle).filter(p=>['.js','.css','.html'].includes(extname(p)))) {
    const code=readFileSync(path,'utf8');
    for (const pattern of forbiddenBundle) if (pattern.test(code)) violations.push(`${path}: ${pattern}`);
  }
}
if (violations.length) {console.error(violations.join('\n'));process.exitCode=1;}
else console.log(`PASS: active TwiPay source excludes prohibited betting implementation${built?' and built assets were inspected':' (built asset check NOT run)'}`);
