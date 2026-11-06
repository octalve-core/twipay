import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { adminSignIn, adminSignOut, navLink, openAdminTab } from '../lib/admin.js';
import type { World } from '../lib/world.js';

// The real nav (apps/admin/app/_components/ops-shell.tsx): label and the permission it needs. A matrix test keeps the rows honest.
const NAV: Array<[string, string]> = [
  ['Overview', 'ops.dashboard.read'], ['Payout Batches', 'ops.dashboard.read'],
  ['Refunds & Disputes', 'ops.disputes.review'], ['Exceptions & Holds', 'ops.reconciliation.read'], ['Financial Tiers', 'ops.tiers.read'],
  ['Provider Circuits', 'ops.dashboard.read'], ['Delivery Health', 'ops.notifications.read'], ['Identity Review', 'ops.compliance.read'],
  ['Audit Journal', 'ops.audit.read'], ['Financial Reports', 'ops.reports.read'], ['Owner Control', 'SUPER_ADMIN'],
  ['Configuration', 'ops.owner.read'], ['Staff Governance', 'SUPER_ADMIN'], ['Customer Master', 'SUPER_ADMIN'],
  ['Support Cases', 'ops.support.read'], ['Security & MFA', ''],
];
const staff = [
  { key: 'support', role: 'SUPPORT_AGENT', first: 'Support Cases' },
  { key: 'financeOp', role: 'FINANCE_OPERATOR', first: 'Payout Batches' },
  { key: 'financeAp', role: 'FINANCE_APPROVER', first: 'Financial Tiers' },
  { key: 'compliance', role: 'COMPLIANCE', first: 'Identity Review' },
  { key: 'operations', role: 'OPERATIONS', first: 'Delivery Health' },
  { key: 'auditor', role: 'AUDITOR', first: 'Audit Journal' },
];

// Chapter 10: every staff role signs in and sees only the pages its permissions allow (negative coverage: absence is part of the product).
export async function staffSessions(w: World): Promise<void> {
  const { step } = w;
  const admin = await openAdminTab(w);
  const snapshot = JSON.parse(readFileSync('tests/walkthrough/matrix/role-permissions.json', 'utf8')) as { roles: Record<string, string[]> };
  for (const s of staff) {
    const allowed = new Set(snapshot.roles[s.role]);
    await step({ chapter: 'Staff sessions', role: s.role, tab: 'admin', name: `Sign in as ${s.role}: only the allowed pages are in the menu`, covers: s.role === 'SUPPORT_AGENT' ? ['N02', 'X02'] : ['N02'] }, async () => {
      await adminSignIn(admin, w.people[s.key]!);
      await expect(admin.getByText(s.role, { exact: true }).first()).toBeVisible();
      for (const [label, permission] of NAV) {
        const visible = permission === '' || allowed.has(permission);
        await expect(admin.getByRole('link', { name: new RegExp(label.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')) }), `${s.role} ${label}`).toHaveCount(visible ? 1 : 0);
      }
    });
    await step({ chapter: 'Staff sessions', role: s.role, tab: 'admin', name: `Open ${s.first} and sign out`, covers: [] }, async () => {
      await navLink(admin, s.first).click();
      await expect(admin.getByRole('heading', { level: 1 })).toBeVisible();
      await adminSignOut(admin);
    });
  }
}
