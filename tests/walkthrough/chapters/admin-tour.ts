import { expect } from '@playwright/test';
import { adminSignIn, adminSignOut, navLink, openAdminTab, stepUp } from '../lib/admin.js';
import type { World } from '../lib/world.js';

interface Stop { nav: string; title: string; covers: string[]; extra?: (w: World) => Promise<void> }

// Chapter 8: owner 1 visits every admin page by clicking the nav, and presses the safe buttons on each (filters, refresh).
export async function adminTour(w: World): Promise<void> {
  const { step } = w;
  const admin = await openAdminTab(w);
  const o1 = w.people['owner1']!;
  await step({ chapter: 'Admin tour', role: 'owner 1', tab: 'admin', name: 'Sign in and step the session up with an authenticator code', covers: [] }, async () => {
    await adminSignIn(admin, o1);
    await expect(admin).toHaveURL(/\/owner$/);
    await stepUp(admin, w.secrets['owner1']!);
  });
  const stops: Stop[] = [
    { nav: 'Overview', title: 'Operations Overview & Telemetry', covers: ['A02'] },
    { nav: 'Payout Batches', title: 'Organizer Disbursements & Payouts', covers: ['A03'] },
    { nav: 'Batch Calculator', title: 'Batch Payout Calculator & Simulator', covers: ['A04'] },
    { nav: 'Refunds & Disputes', title: 'Refunds, Disputes & Ledger Reversals', covers: ['A05'] },
    { nav: 'Exceptions & Holds', title: 'Financial Exceptions & Wallet Holds', covers: ['A06'] },
    { nav: 'Financial Tiers', title: 'Financial Tiers & Caps Governance', covers: ['A07'] },
    { nav: 'Provider Circuits', title: 'Provider Routing & Circuit Breaker Health', covers: ['A08'], extra: async () => { await admin.getByRole('button', { name: /Refresh Circuits/ }).click(); } },
    { nav: 'Delivery Health', title: 'Notification Delivery Health & Telemetry', covers: ['A09'], extra: async () => { await admin.getByRole('button', { name: /Refresh Delivery Summary/ }).click(); } },
    { nav: 'Identity Review', title: 'Compliance & Identity Review', covers: ['A10'] },
    { nav: 'Audit Journal', title: 'Operational Audit Trail', covers: ['A11'], extra: async () => { await admin.getByRole('button', { name: 'LOGIN', exact: true }).click(); } },
    { nav: 'Financial Reports', title: 'Financial Reports & Commission Ledgers', covers: ['A12'] },
    { nav: 'Owner Control', title: 'Owner control centre', covers: ['A13'] },
    { nav: 'Configuration', title: 'Configuration, Feature Flags & Licensing', covers: ['A14'] },
    { nav: 'Staff Governance', title: 'Staff Governance & Role Delegations', covers: ['A15'] },
    { nav: 'Customer Master', title: 'Customer Oversight & Account Master-Detail', covers: ['A16'] },
    { nav: 'Support Cases', title: 'Customer Support Operations & Inquiries', covers: ['A17'] },
  ];
  for (const stop of stops) {
    await step({ chapter: 'Admin tour', role: 'owner 1', tab: 'admin', name: `Open ${stop.nav}`, covers: stop.covers }, async () => {
      await navLink(admin, stop.nav).click();
      await expect(admin.getByRole('heading', { level: 1, name: stop.title })).toBeVisible();
      await expect(admin.getByText(/Loading authorized/)).toBeHidden({ timeout: 20_000 });
      await stop.extra?.(w);
    });
  }
  await step({ chapter: 'Admin tour', role: 'owner 1', tab: 'admin', name: 'Sign out', covers: [] }, async () => {
    await adminSignOut(admin);
  });
}
