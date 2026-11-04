import type { Locator } from '@playwright/test';

// Real key presses at human speed (50 to 120 ms a key). Never use fill().
export async function typeLikeAPerson(target: Locator, text: string): Promise<void> {
  await target.click();
  for (const character of text) {
    await target.pressSequentially(character, { delay: 0 });
    await target.page().waitForTimeout(50 + Math.floor(Math.random() * 71));
  }
}
