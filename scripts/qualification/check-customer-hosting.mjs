#!/usr/bin/env node
/** Production-safe Vite/API session-hosting contract. Reads configuration only; makes no requests. */
import { isIP } from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const flags = [
  'VITE_TWIPAY_FUNDING_SANDBOX_ENABLED',
  'VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED',
  'VITE_TWIPAY_VIRTUAL_ACCOUNT_SANDBOX_ENABLED',
  'VITE_TWIPAY_BILLS_SANDBOX_ENABLED',
  'VITE_TWIPAY_EVENT_CHECKOUT_SANDBOX_ENABLED',
];
function exactOrigin(input, field) {
  let url;
  try { url = new URL(input); } catch { throw new Error(`${field}_MUST_BE_ABSOLUTE_HTTPS_ORIGIN`); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
      url.port || url.pathname !== '/' || url.search || url.hash || isIP(url.hostname) ||
      url.hostname === 'localhost' || url.hostname.endsWith('.local')) {
    throw new Error(`${field}_MUST_BE_ABSOLUTE_HTTPS_ORIGIN`);
  }
  return url;
}
function sameConfiguredSite(host, approved) {
  return host === approved || host.endsWith(`.${approved}`);
}
export function validateCustomerHosting(env, config) {
  const site = env.TWIPAY_APPROVED_SITE_HOST?.trim().toLowerCase();
  // Deliberately require an explicit organization-controlled site. Do not
  // infer a cookie site from a third-party preview deployment hostname.
  if (!site || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(site) ||
      site.split('.').length < 2 || isIP(site) || site.endsWith('.local') ||
      ['com','net','org','co.uk','vercel.app','pages.dev'].includes(site)) {
    throw new Error('APPROVED_SITE_HOST_REQUIRED');
  }
  const app = exactOrigin(env.APP_URL, 'APP_URL');
  const api = exactOrigin(env.VITE_TWIPAY_API_URL, 'VITE_TWIPAY_API_URL');
  const admin = exactOrigin(env.ADMIN_URL, 'ADMIN_URL');
  if (![app, api, admin].every(u => sameConfiguredSite(u.hostname, site))) {
    throw new Error('CROSS_SITE_STRICT_COOKIES_NOT_SUPPORTED');
  }
  if (app.origin === admin.origin) throw new Error('ADMIN_CUSTOMER_ORIGINS_MUST_BE_SEPARATE');
  if (api.origin === app.origin || api.origin === admin.origin) {
    throw new Error('API_HOST_MUST_BE_SEPARATE_FOR_HOST_ONLY_SESSION_COOKIES');
  }
  for (const flag of flags) {
    if (env[flag] !== 'false') throw new Error(`PRODUCTION_FLAG_NOT_DISABLED:${flag}`);
  }
  for (const key of Object.keys(env)) {
    if (key.startsWith('VITE_') && /(?:SECRET|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_TOKEN)/i.test(key)) {
      throw new Error('PUBLIC_VITE_ENV_CANNOT_CONTAIN_CREDENTIALS');
    }
  }
  if (!Array.isArray(config.rewrites) || !config.rewrites.some(r => r.source === '/(.*)' && r.destination === '/index.html')) {
    throw new Error('SPA_DEEP_LINK_REWRITE_REQUIRED');
  }
  const flatHeaders = (config.headers ?? []).flatMap(r => r.headers ?? []);
  for (const name of ['X-Content-Type-Options','X-Frame-Options','Referrer-Policy']) {
    if (!flatHeaders.some(h => h.key.toLowerCase() === name.toLowerCase())) throw new Error(`HOSTING_HEADER_MISSING:${name}`);
  }
  return {customerOrigin:app.origin,apiOrigin:api.origin,adminOrigin:admin.origin,approvedSite:site,productionFinancialFlags:'disabled'};
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    const config = JSON.parse(readFileSync(new URL('../../apps/customer-ui/vercel.json',import.meta.url),'utf8'));
    const result = validateCustomerHosting(process.env,config);
    console.log('CUSTOMER_HOSTING_SOURCE_CONTRACT_PASS',JSON.stringify(result));
  } catch (error) {
    console.error(`CUSTOMER_HOSTING_SOURCE_CONTRACT_FAIL: ${error.message}`);
    process.exitCode = 2;
  }
}
