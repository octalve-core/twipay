import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { caption } from './overlay.js';

// Every journey step goes through step(): it times the step, shows the caption in the video, takes the screenshot and
// records which coverage rows the step proves. timeline.json then feeds the PDF captions, the coverage ticks and the
// video chapters.
export interface TimelineEntry { id: string; chapter: string; role: string; name: string; covers: string[]; startMs: number; endMs: number; screenshot: string }

export function createTimeline(page: Page, outputRoot: string) {
  const startedAt = Date.now();
  const entries: TimelineEntry[] = [];
  mkdirSync(join(outputRoot, 'screenshots'), { recursive: true });

  async function step(meta: { chapter: string; role: string; name: string; covers: string[] }, action: () => Promise<void>): Promise<void> {
    const id = `s${String(entries.length + 1).padStart(3, '0')}`;
    const startMs = Date.now() - startedAt;
    await caption(page, `${meta.role}: ${meta.name}`);
    await action(); // a failing assertion here fails the run: that failure is a finding
    const screenshot = `screenshots/${id}.png`;
    await page.screenshot({ path: join(outputRoot, screenshot) });
    entries.push({ id, ...meta, startMs, endMs: Date.now() - startedAt, screenshot });
  }

  function write(): void {
    writeFileSync(join(outputRoot, 'timeline.json'), `${JSON.stringify(entries, null, 2)}\n`);
  }
  return { step, write, entries, startedAt };
}
