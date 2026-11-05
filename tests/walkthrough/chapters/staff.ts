import { expect } from '@playwright/test';
import { adminSignIn, adminSignOut, navLink, openAdminTab, stepUp, typeDialogCode } from '../lib/admin.js';
import { bootstrapRoles } from '../lib/stage.js';
import { typeLikeAPerson } from '../lib/human.js';
import { clearAndType } from '../lib/ui.js';
import type { World } from '../lib/world.js';

// The proposal screen offers only these three roles (its banner: "Only support, audit and compliance roles can be delegated").
const roles: Array<{ key: string; role: string; label: string }> = [
  { key: 'support', role: 'SUPPORT_AGENT', label: 'support agent' },
  { key: 'compliance', role: 'COMPLIANCE', label: 'compliance officer' },
  { key: 'auditor', role: 'AUDITOR', label: 'auditor' },
];
const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

// Chapter 9: maker/checker. Owner 1 (maker) finds each person in Customer Master, copies the UUID and proposes a role; owner 2
// (checker) approves. The proposer's own approval attempt is shown being refused.
export async function staffGovernance(w: World): Promise<void> {
  const { step } = w;
  const admin = await openAdminTab(w);
  const ids: Record<string, string> = {};
  await step({ chapter: 'Staff governance', role: 'owner 1', tab: 'admin', name: 'Sign in and step up', covers: [] }, async () => {
    await adminSignIn(admin, w.people['owner1']!);
    await stepUp(admin, w.secrets['owner1']!);
  });
  for (const r of roles) {
    await step({ chapter: 'Staff governance', role: 'owner 1', tab: 'admin', name: `Find ${r.label} in Customer Master and read the UUID`, covers: [] }, async () => {
      await navLink(admin, 'Customer Master').click();
      await clearAndType(admin.locator('input[placeholder^="e.g. merchant"]'), w.people[r.key]!.email);
      await admin.getByRole('button', { name: 'Search Securely' }).click();
      // Wait for the result to be this person (one record, and not a UUID already read) before reading the UUID.
      await expect(admin.getByText('Customer Directory (1 Records)')).toBeVisible();
      const row = admin.locator('tbody tr').filter({ hasText: uuid }).first();
      for (const previous of Object.values(ids)) await expect(row).not.toContainText(previous);
      ids[r.key] = (await row.innerText()).match(uuid)?.[0] ?? '';
      expect(ids[r.key], 'the row shows the customer UUID').toMatch(uuid);
    });
  }
  for (const r of roles) {
    await step({ chapter: 'Staff governance', role: 'owner 1', tab: 'admin', name: `Propose ${r.role} for the ${r.label}`, covers: [] }, async () => {
      await navLink(admin, 'Staff Governance').click();
      await typeLikeAPerson(admin.locator('input[name=targetUserId]'), ids[r.key]!);
      await admin.locator('select[name=roleCode]').selectOption(r.role);
      await typeLikeAPerson(admin.locator('input[name=reason]'), `Walkthrough: grant ${r.label} access`);
      await admin.getByRole('button', { name: /Prepare for independent approval/ }).click();
      await expect(admin.getByText('Proposal recorded. A different owner must approve it.')).toBeVisible();
    });
  }
  await step({ chapter: 'Staff governance', role: 'owner 1', tab: 'admin', name: 'Try to approve his own proposal', covers: ['N03'] }, async () => {
    await admin.getByRole('button', { name: 'Approve' }).first().click();
    await typeDialogCode(admin, w.secrets['owner1']!);
    await admin.getByRole('button', { name: /Authorize & Release/ }).click();
    await expect(admin.getByText('A different owner must approve this')).toBeVisible();
  });
  await step({ chapter: 'Staff governance', role: 'owner 1', tab: 'admin', name: 'Sign out', covers: [] }, async () => {
    await adminSignOut(admin);
  });
  await step({ chapter: 'Staff governance', role: 'owner 2', tab: 'admin', name: 'Sign in and step up', covers: [] }, async () => {
    await adminSignIn(admin, w.people['owner2']!);
    await stepUp(admin, w.secrets['owner2']!);
  });
  for (const r of roles) {
    await step({ chapter: 'Staff governance', role: 'owner 2', tab: 'admin', name: `Approve ${r.role} for the ${r.label} as the independent checker`, covers: [] }, async () => {
      await navLink(admin, 'Staff Governance').click();
      await admin.getByRole('row').filter({ hasText: r.role }).getByRole('button', { name: 'Approve' }).click();
      await typeDialogCode(admin, w.secrets['owner2']!);
      await admin.getByRole('button', { name: /Authorize & Release/ }).click();
      await expect(admin.getByText('Independent review approval recorded.')).toBeVisible();
    });
  }
  await step({ chapter: 'Staff governance', role: 'owner 2', tab: 'admin', name: 'Sign out', covers: [] }, async () => {
    await adminSignOut(admin);
  });
  await step({ chapter: 'Staff governance', role: 'operator', name: 'Operator bootstrap: grant the finance and operations roles (no screen delegates them; not a user action)', covers: [] }, async () => {
    bootstrapRoles([
      { email: w.people['financeOp']!.email, role: 'FINANCE_OPERATOR' },
      { email: w.people['financeAp']!.email, role: 'FINANCE_APPROVER' },
      { email: w.people['operations']!.email, role: 'OPERATIONS' },
    ]);
  });
}
