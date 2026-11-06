import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { scanAccessibility, type AxeFinding } from './axe.js';
import { screenChecks, type ScreenChecks } from './observers.js';
import { caption } from './overlay.js';
import { runStep } from './soft.js';

// Every journey step goes through step(): it times the step, shows the caption in the video, takes the screenshot and
// records which coverage rows the step proves. timeline.json then feeds the PDF captions, the coverage ticks and the
// video chapters. The customer app and the admin console are different origins that no link joins, so each is its own tab
// (one first page load each); `tab` says which tab a step happens in, so the recordings can be cut together by the timeline.
export type Tab = 'customer' | 'admin';
export interface TimelineEntry { id: string; chapter: string; role: string; tab: Tab; name: string; covers: string[]; startMs: number; endMs: number; screenshot: string; ok: boolean; checks: ScreenChecks; axe: AxeFinding[] }

export function createTimeline(pages: Record<Tab, Page | undefined>, outputRoot: string) {
  const startedAt = Date.now();
  const entries: TimelineEntry[] = [];
  mkdirSync(join(outputRoot, 'screenshots'), { recursive: true });

  async function step(meta: { chapter: string; role: string; name: string; covers: string[]; tab?: Tab }, action: () => Promise<void>): Promise<void> {
    const tab = meta.tab ?? 'customer';
    const page = pages[tab];
    if (!page) throw new Error(`WALKTHROUGH_RULE: no ${tab} tab is open yet`);
    const id = `s${String(entries.length + 1).padStart(3, '0')}`;
    const startMs = Date.now() - startedAt;
    await caption(page, `${meta.role}: ${meta.name}`);
    // A failing assertion fails the run (strict) or is recorded and skipped (soft recon): either way it is a finding.
    const ok = await runStep(`${meta.role}: ${meta.name}`, action);
    await page.waitForTimeout(600); // a short beat for loading states to finish before the screenshot, as a fast person would
    const screenshot = `screenshots/${id}.png`;
    await page.screenshot({ path: join(outputRoot, screenshot) });
    const checks = await screenChecks(page);
    const axe = await scanAccessibility(page);
    entries.push({ id, chapter: meta.chapter, role: meta.role, tab, name: meta.name, covers: ok ? meta.covers : [], startMs, endMs: Date.now() - startedAt, screenshot, ok, checks, axe });
  }

  function write(): void {
    writeFileSync(join(outputRoot, 'timeline.json'), `${JSON.stringify(entries, null, 2)}\n`);
  }
  return { step, write, entries, startedAt };
}
