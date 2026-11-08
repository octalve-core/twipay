import type { Page } from '@playwright/test';

// Observer only: records what a person would notice (console errors, page errors, failed requests, 4xx/5xx) as findings.
export interface Observation { kind: 'console' | 'pageerror' | 'requestfailed' | 'http'; detail: string; url: string; atMs: number }

export function observe(page: Page, startedAt: number, seen: Observation[] = []): Observation[] {
  const push = (kind: Observation['kind'], detail: string) => seen.push({ kind, detail: detail.slice(0, 240), url: page.url(), atMs: Date.now() - startedAt });
  page.on('console', (message) => { if (message.type() === 'error') push('console', message.text()); });
  page.on('pageerror', (error) => push('pageerror', String(error)));
  page.on('requestfailed', (request) => push('requestfailed', `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => {
    if (response.status() >= 400) push('http', `${response.status()} ${response.request().method()} ${response.url()}`);
  });
  return seen;
}

// What a person would notice on the screen right now: images that failed to load, raw machine error codes shown as text, and
// placeholder-looking numbers. Observer only: it reads the page and never changes it.
export interface ScreenChecks { brokenImages: number; rawCodes: string[] }

export async function screenChecks(page: Page): Promise<ScreenChecks> {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const brokenImages = Array.from(document.images).filter((img) => visible(img) && img.complete && img.naturalWidth === 0).length;
    const text = document.body.innerText;
    const rawCodes = Array.from(new Set<string>(text.match(/\b[A-Z]{3,}(?:_[A-Z0-9]{2,}){1,}\b/g) ?? [])).filter((c) => !/^(SUPER_ADMIN|SUPPORT_AGENT|FINANCE_OPERATOR|FINANCE_APPROVER|COMPLIANCE|AUDITOR|OPERATIONS|NGN|BVN|NIN)$/.test(c)).slice(0, 5);
    return { brokenImages, rawCodes };
  });
}
