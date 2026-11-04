import { expect, type Page } from '@playwright/test';

// Reads a code the way a developer would: open the floating dev-inbox button inside the app, find the message for the
// address, read the code chip, close the panel. The sink is a LOCAL SIMULATOR of an email provider (labelled in the PDF).
export async function readEmailedCode(page: Page, address: string, subjectContains: string, waitMs = 45_000): Promise<string> {
  await page.getByRole('button', { name: 'Open development inbox' }).click();
  const panel = page.getByRole('dialog', { name: 'Development inbox' });
  await expect(panel).toBeVisible();
  // Messages are cards (.msg) with a subject and a code chip; the newest is first.
  const message = panel.locator('.msg').filter({ hasText: address }).filter({ has: page.locator('.subject', { hasText: subjectContains }) }).first();
  await expect(message).toBeVisible({ timeout: waitMs });
  const code = (await message.locator('.code').innerText()).match(/\b\d{6,8}\b/)?.[0];
  expect(code, `no code in the "${subjectContains}" email for ${address}`).toBeTruthy();
  await page.keyboard.press('Escape');
  return code!;
}
