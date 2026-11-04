import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

// Observer only: runs axe on the current screen and returns violations. serious/critical block the run (see the journey),
// the rest are listed in findings.md.
export interface AxeFinding { id: string; impact: string; help: string; nodes: number; url: string }

export async function scanAccessibility(page: Page): Promise<AxeFinding[]> {
  const result = await new AxeBuilder({ page }).analyze();
  return result.violations.map((v) => ({ id: v.id, impact: v.impact ?? 'minor', help: v.help, nodes: v.nodes.length, url: page.url() }));
}
