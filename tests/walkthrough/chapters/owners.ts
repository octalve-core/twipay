import { expect } from '@playwright/test';
import { adminSignIn, adminSignOut, enrolMfa, navLink, openAdminTab, stepUp } from '../lib/admin.js';
import { bootstrapOwners } from '../lib/stage.js';
import type { World } from '../lib/world.js';

// Chapter 7: two owners get the SUPER_ADMIN role (operator bootstrap: no screen creates the first owner), sign in to the admin console,
// are held at the MFA wall, enrol an authenticator and step up. The admin console is its own tab (different origin, no link joins them).
export async function ownersChapter(w: World): Promise<void> {
  const { step } = w;
  const o1 = w.people['owner1']!;
  const o2 = w.people['owner2']!;
  await step({ chapter: 'Owners', role: 'operator', name: 'Operator bootstrap: grant SUPER_ADMIN to the two owner accounts (not a user action)', covers: [] }, async () => {
    bootstrapOwners([o1.email, o2.email]);
  });
  const admin = await openAdminTab(w);
  await step({ chapter: 'Owners', role: 'owner 1', tab: 'admin', name: 'Open the admin sign-in', covers: ['A01'] }, async () => {
    await expect(admin.getByRole('heading', { name: 'Authorized staff sign-in' })).toBeVisible();
  });
  await step({ chapter: 'Owners', role: 'owner 1', tab: 'admin', name: 'Sign in with the wrong password and read the message', covers: [] }, async () => {
    await admin.locator('input[name=email]').pressSequentially(o1.email, { delay: 30 });
    await admin.locator('input[name=password]').pressSequentially('Not-the-right-pass-1', { delay: 30 });
    await admin.getByRole('button', { name: 'Sign in' }).click();
    await expect(admin.getByText('Unable to authenticate. Verify operator credentials.')).toBeVisible();
  });
  await step({ chapter: 'Owners', role: 'owner 1', tab: 'admin', name: 'Sign in with the right password', covers: [] }, async () => {
    await admin.locator('input[name=password]').press('Control+A');
    await admin.locator('input[name=password]').press('Backspace');
    await admin.locator('input[name=password]').pressSequentially(o1.password, { delay: 40 });
    await admin.getByRole('button', { name: 'Sign in' }).click();
    await expect(admin).toHaveURL(/\/owner$/);
  });
  await step({ chapter: 'Owners', role: 'owner 1', tab: 'admin', name: 'Open Owner Control before enrolling an authenticator and read what is shown', covers: ['N04'] }, async () => {
    await expect(admin.getByRole('heading', { level: 1, name: 'Owner control centre' })).toBeVisible();
  });
  await step({ chapter: 'Owners', role: 'owner 1', tab: 'admin', name: 'Enrol an authenticator under Security & MFA', covers: [] }, async () => {
    w.secrets['owner1'] = await enrolMfa(admin, o1);
  });
  await step({ chapter: 'Owners', role: 'owner 1', tab: 'admin', name: 'Step up the session with a fresh code', covers: ['A18'] }, async () => {
    await stepUp(admin, w.secrets['owner1']!);
    await navLink(admin, 'Owner Control').click();
    await expect(admin).toHaveURL(/\/owner$/);
  });
  await step({ chapter: 'Owners', role: 'owner 1', tab: 'admin', name: 'Sign out', covers: ['A19'] }, async () => {
    await adminSignOut(admin);
  });
  await step({ chapter: 'Owners', role: 'owner 2', tab: 'admin', name: 'Sign in, enrol an authenticator, step up', covers: [] }, async () => {
    await adminSignIn(admin, o2);
    await expect(admin).toHaveURL(/\/owner$/);
    w.secrets['owner2'] = await enrolMfa(admin, o2);
    await stepUp(admin, w.secrets['owner2']!);
  });
  await step({ chapter: 'Owners', role: 'owner 2', tab: 'admin', name: 'Sign out', covers: [] }, async () => {
    await adminSignOut(admin);
  });
}
