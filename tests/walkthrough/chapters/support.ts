import { expect } from '@playwright/test';
import { freshCode } from '../lib/authenticator.js';
import { adminSignIn, adminSignOut, enrolMfa, navLink, openAdminTab, stepUp } from '../lib/admin.js';
import { typeLikeAPerson } from '../lib/human.js';
import { button, clickLink, link, signInCustomer } from '../lib/ui.js';
import type { World } from '../lib/world.js';

// Chapter 11 (X01): Ada's support request from chapter 4 reaches the support agent, who needs recent MFA to read it and answers;
// Ada signs back in (with her authenticator code) and reads the answer. The two sides never stay signed in together: the session
// cookie is shared by both tabs because they share the host name (a finding for same-host deployments).
export async function supportRoundTrip(w: World): Promise<void> {
  const { step, page } = w;
  const admin = await openAdminTab(w);
  const agent = w.people['support']!;
  const reply = 'We refreshed your history view. Please sign out and in again.';
  await step({ chapter: 'Support round trip', role: 'support agent', tab: 'admin', name: 'Sign in, enrol an authenticator and step up (support needs recent MFA)', covers: [] }, async () => {
    await adminSignIn(admin, agent);
    w.secrets['support'] = await enrolMfa(admin, agent);
    await stepUp(admin, w.secrets['support']!);
  });
  await step({ chapter: 'Support round trip', role: 'support agent', tab: 'admin', name: 'Open Support Cases, review a ticket and reply', covers: ['A17'] }, async () => {
    await navLink(admin, 'Support Cases').click();
    await admin.getByRole('row').filter({ hasText: 'Cannot see my history' }).first().getByRole('button', { name: /Review/ }).click();
    await typeLikeAPerson(admin.locator('#support-response'), reply);
    await admin.getByRole('button', { name: /Send Reply/ }).click();
    await expect(admin.locator('#support-response')).toHaveValue('');
  });
  await step({ chapter: 'Support round trip', role: 'support agent', tab: 'admin', name: 'Sign out', covers: [] }, async () => {
    await adminSignOut(admin);
  });
  await step({ chapter: 'Support round trip', role: 'customer Ada', name: 'Sign in with the authenticator code', covers: [] }, async () => {
    await signInCustomer(page, w.people['ada']!);
    await expect(page).toHaveURL(/two-factor-authentication/);
    await typeLikeAPerson(page.locator('input[data-input-otp]'), await freshCode(page, w.secrets['ada']!));
    await button(page, /^Verify and continue/).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
  await step({ chapter: 'Support round trip', role: 'customer Ada', name: 'Open Help centre and read the support reply', covers: ['X01'] }, async () => {
    await clickLink(page, 'Settings');
    await link(page, /^Help centre/).click();
    await page.getByText('Cannot see my history').first().click();
    await expect(page.getByText(reply)).toBeVisible();
  });
  await step({ chapter: 'Support round trip', role: 'customer Ada', name: 'Log out before the admin console is used again (both apps share one browser session on this host)', covers: [] }, async () => {
    await clickLink(page, 'Settings');
    await button(page, /^Log out/).click();
    await button(page, 'Yes, Logout').click();
    await expect(page.getByText('Logged out.')).toBeVisible();
  });
}
