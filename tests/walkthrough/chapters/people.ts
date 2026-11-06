import { expect } from '@playwright/test';
import { button, clickLink, signUpAndVerify } from '../lib/ui.js';
import type { World } from '../lib/world.js';

export async function logOutCustomer(w: World, role: string): Promise<void> {
  const { page, step } = w;
  await step({ chapter: 'People', role, name: 'Log out from Settings', covers: [] }, async () => {
    await clickLink(page, 'Settings');
    await button(page, /^Log out/).click();
    await button(page, 'Yes, Logout').click();
    await expect(page.getByText('Logged out.')).toBeVisible();
  });
}

// Chapter 6: every other account is created the way a person would, through the sign-up form and the emailed code.
// Ben is a second ordinary customer; the owners and the six staff roles start as customers too (staff are granted a role by owners later).
export async function signUpEveryone(w: World): Promise<void> {
  const { page, step } = w;
  await logOutCustomer(w, 'customer Ada');
  const list: Array<[string, string]> = [
    ['ben', 'customer Ben'], ['owner1', 'future owner 1'], ['owner2', 'future owner 2'], ['support', 'future support agent'],
    ['financeOp', 'future finance operator'], ['financeAp', 'future finance approver'], ['compliance', 'future compliance officer'],
    ['operations', 'future operations'], ['auditor', 'future auditor'],
  ];
  for (const [key, role] of list) {
    const who = w.people[key]!;
    await step({ chapter: 'People', role, name: `Sign up ${who.given} and confirm the emailed code`, covers: [] }, async () => {
      await signUpAndVerify(page, who);
    });
    await logOutCustomer(w, role);
  }
}
