import { test, expect } from '@playwright/test';
import { firstLoad } from '../lib/nav.js';
import { installOverlay } from '../lib/overlay.js';
import { observe } from '../lib/observers.js';
import { createTimeline } from '../lib/timeline.js';
import { typeLikeAPerson } from '../lib/human.js';
import { totp } from '../lib/authenticator.js';

test('harness smoke', async ({ page, context }) => {
  await installOverlay(context);
  const started = Date.now();
  const seen = observe(page, started);
  const timeline = createTimeline(page, process.env['WT_OUTPUT_ROOT'] ?? 'out/walkthrough/smoke');
  await firstLoad(page, 'data:text/html,<input id=a placeholder=name><button onclick="document.title=\'clicked\'">Go</button>');
  await timeline.step({ chapter: 'smoke', role: 'visitor', name: 'type and click', covers: ['C01'] }, async () => {
    await typeLikeAPerson(page.locator('#a'), 'hello');
    await page.getByRole('button', { name: 'Go' }).click();
    await expect(page).toHaveTitle('clicked');
  });
  await expect(firstLoad(page, 'data:text/html,x')).rejects.toThrow('WALKTHROUGH_RULE');
  expect(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000)).toBe('287082'); // RFC 6238 vector, 6 digits
  timeline.write();
  expect(seen.filter((o) => o.kind === 'pageerror')).toEqual([]);
});
