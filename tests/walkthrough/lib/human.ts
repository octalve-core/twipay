import type { Locator } from '@playwright/test';

// Real key presses at the speed of a very fast typist (18 to 45 ms a key). Never use fill().
export async function typeLikeAPerson(target: Locator, text: string): Promise<void> {
  await target.click();
  for (const character of text) {
    await target.pressSequentially(character, { delay: 0 });
    await target.page().waitForTimeout(18 + Math.floor(Math.random() * 28));
  }
}
