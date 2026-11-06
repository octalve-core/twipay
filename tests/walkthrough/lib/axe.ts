import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

// Observer only: runs axe on the current screen and returns violations. serious/critical block the run (see the journey),
// the rest are listed in findings.md. For colour contrast it also keeps the failing colour pairs, so a fix can target them.
export interface ContrastNode { target: string; fg: string; bg: string; ratio: number; expected: string; size: string; text: string }
export interface AxeFinding { id: string; impact: string; help: string; nodes: number; url: string; contrast?: ContrastNode[] }

interface ContrastData { fgColor?: string; bgColor?: string; contrastRatio?: number; expectedContrastRatio?: string; fontSize?: string }

export async function scanAccessibility(page: Page): Promise<AxeFinding[]> {
  const result = await new AxeBuilder({ page }).analyze();
  return result.violations.map((v) => {
    const finding: AxeFinding = { id: v.id, impact: v.impact ?? 'minor', help: v.help, nodes: v.nodes.length, url: page.url() };
    if (v.id === 'color-contrast') {
      finding.contrast = v.nodes.slice(0, 40).map((n) => {
        const data = (n.any[0]?.data ?? {}) as ContrastData;
        return { target: n.target.join(' ').slice(0, 120), fg: data.fgColor ?? '', bg: data.bgColor ?? '', ratio: data.contrastRatio ?? 0, expected: data.expectedContrastRatio ?? '', size: data.fontSize ?? '', text: (n.html.replace(/<[^>]+>/g, '').trim() || n.html).slice(0, 60) };
      });
    }
    return finding;
  });
}
