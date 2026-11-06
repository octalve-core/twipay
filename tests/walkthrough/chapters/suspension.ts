import { expect } from '@playwright/test';
import { adminSignIn, adminSignOut, navLink, openAdminTab, stepUp, typeDialogCode } from '../lib/admin.js';
import { typeLikeAPerson } from '../lib/human.js';
import { authBudget } from '../lib/pace.js';
import { button, clearAndType } from '../lib/ui.js';
import type { World } from '../lib/world.js';

const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

// Chapter 12: a customer cannot enter the admin console (N01, N05); then owners suspend that customer with maker/checker (X04) and the
// customer can no longer sign in.
export async function suspensionChapter(w: World): Promise<void> {
  const { step, page } = w;
  const admin = await openAdminTab(w);
  const ben = w.people['ben']!;
  await step({ chapter: 'Suspension', role: 'customer Ben', tab: 'admin', name: 'Sign in to the admin console with customer credentials and read the refusal', covers: ['N01', 'N05'] }, async () => {
    await adminSignIn(admin, ben);
    await expect(admin.getByText('This account lacks operational clearance or permissions.')).toBeVisible();
  });
  await step({ chapter: 'Suspension', role: 'owner 1', tab: 'admin', name: 'Sign in, step up, find Ben in Customer Master and prepare a suspension', covers: [] }, async () => {
    await adminSignIn(admin, w.people['owner1']!);
    await stepUp(admin, w.secrets['owner1']!);
    await navLink(admin, 'Customer Master').click();
    await clearAndType(admin.locator('input[placeholder^="e.g. merchant"]'), ben.email);
    await admin.getByRole('button', { name: 'Search Securely' }).click();
    await expect(admin.getByText('Customer Directory (1 Records)')).toBeVisible();
    const id = (await admin.locator('tbody tr').filter({ hasText: uuid }).first().innerText()).match(uuid)?.[0] ?? '';
    expect(id).toMatch(uuid);
    await typeLikeAPerson(admin.locator('input[name=targetUserId]'), id);
    await typeLikeAPerson(admin.locator('input[name=reason]'), 'Walkthrough: demonstrate the suspension flow');
    await admin.getByRole('button', { name: /Prepare Suspension for Checker/ }).click();
    await expect(admin.getByText('0 Staged')).toBeHidden();
  });
  await step({ chapter: 'Suspension', role: 'owner 1', tab: 'admin', name: 'Sign out', covers: [] }, async () => {
    await adminSignOut(admin);
  });
  await step({ chapter: 'Suspension', role: 'owner 2', tab: 'admin', name: 'Sign in, step up and approve the suspension as the checker', covers: ['X04'] }, async () => {
    await adminSignIn(admin, w.people['owner2']!);
    await stepUp(admin, w.secrets['owner2']!);
    await navLink(admin, 'Customer Master').click();
    await admin.getByRole('row').filter({ hasText: uuid }).getByRole('button', { name: 'Approve' }).first().click();
    await typeDialogCode(admin, w.secrets['owner2']!);
    await admin.getByRole('button', { name: /Authorize & Release/ }).click();
    await expect(admin.getByText(/suspension/i).filter({ hasText: /approv|recorded/i }).first()).toBeVisible();
  });
  await step({ chapter: 'Suspension', role: 'owner 2', tab: 'admin', name: 'Sign out', covers: [] }, async () => {
    await adminSignOut(admin);
  });
  await step({ chapter: 'Suspension', role: 'customer Ben', name: 'Try to sign in: the account is suspended', covers: [] }, async () => {
    await typeLikeAPerson(page.locator('#email'), ben.email);
    await typeLikeAPerson(page.locator('#password'), ben.password);
    await authBudget(page);
    await button(page, 'Log in').click();
    await expect(page).not.toHaveURL(/\/dashboard/);
    await expect(page.getByRole('alert').or(page.getByText(/suspend|unavailable|restricted|not available/i)).first()).toBeVisible();
  });
}
