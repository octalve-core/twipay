#!/usr/bin/env node
/** Prevent the on-demand DAST action scanning arbitrary or production hosts. */
import { isIP } from 'node:net';

export function validateStagingTarget(target, approvedHost) {
  if (!approvedHost || typeof approvedHost !== 'string' || approvedHost.includes('/') || approvedHost.includes(':') || isIP(approvedHost) || approvedHost==='localhost') {
    throw new Error('APPROVED_STAGING_HOST_REQUIRED');
  }
  let url;
  try { url = new URL(target); } catch { throw new Error('STAGING_URL_INVALID'); }
  if (url.protocol !== 'https:' || url.hostname !== approvedHost.toLowerCase() ||
      !/^[-.a-z0-9]+$/i.test(url.hostname) || url.username || url.password || url.port || url.search || url.hash ||
      url.hostname.endsWith('.local') || isIP(url.hostname)) {
    throw new Error('STAGING_TARGET_NOT_EXACTLY_APPROVED');
  }
  return url.href;
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try { validateStagingTarget(process.env.TARGET, process.env.TWIPAY_APPROVED_STAGING_HOST); console.log('APPROVED_STAGING_TARGET'); }
  catch(error) { console.error(error.message); process.exitCode=2; }
}
