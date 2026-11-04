import type { Page } from '@playwright/test';

// Observer only: records what a person would notice (console errors, page errors, failed requests, 4xx/5xx) as findings.
export interface Observation { kind: 'console' | 'pageerror' | 'requestfailed' | 'http'; detail: string; url: string; atMs: number }

export function observe(page: Page, startedAt: number): Observation[] {
  const seen: Observation[] = [];
  const push = (kind: Observation['kind'], detail: string) => seen.push({ kind, detail: detail.slice(0, 240), url: page.url(), atMs: Date.now() - startedAt });
  page.on('console', (message) => { if (message.type() === 'error') push('console', message.text()); });
  page.on('pageerror', (error) => push('pageerror', String(error)));
  page.on('requestfailed', (request) => push('requestfailed', `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => {
    if (response.status() >= 400) push('http', `${response.status()} ${response.request().method()} ${response.url()}`);
  });
  return seen;
}
