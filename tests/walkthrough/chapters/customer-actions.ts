import { expect } from '@playwright/test';
import { typeLikeAPerson } from '../lib/human.js';
import { button, clickLink, expectHeading, link } from '../lib/ui.js';
import type { World } from '../lib/world.js';

// Chapter 3b: the buttons on each page, pressed once with their defaults (empty or pre-filled forms), so the outcome a customer would
// see is on record. Nothing here can move money: provider switches are off in this stack, so a funding or payout attempt is refused.
export async function customerActions(w: World): Promise<void> {
  const { page, step } = w;
  const act = (name: string, covers: string[], run: () => Promise<void>) =>
    step({ chapter: 'Customer: buttons', role: 'customer Ada', name, covers }, async () => {
      // A drawer or dialog left open by the previous step would swallow every navigation click, so each step starts from a clear page.
      await page.keyboard.press('Escape');
      await run();
    });

  await act('Hide and show the wallet balance on the dashboard', [], async () => {
    await clickLink(page, 'Dashboard');
    await button(page, 'Hide wallet balance').click();
    await expect(button(page, 'Show wallet balance')).toBeVisible();
    await button(page, 'Show wallet balance').click();
  });
  await act('History: open Filter, then press Export CSV', [], async () => {
    await clickLink(page, 'History');
    // Export CSV sits on the page, not in the Filter drawer, and is greyed out while there are no transactions.
    await expect(button(page, 'Export CSV')).toBeDisabled();
    await button(page, 'Filter').click();
    await expect(page.getByText('Price range')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Price range')).toBeHidden();
    await expectHeading(page, 'History');
  });
  await act('Add funds: press Proceed with the pre-filled amount and read the outcome', [], async () => {
    await clickLink(page, 'Dashboard');
    await clickLink(page, 'Add Funds');
    await button(page, /^Proceed/).click();
    await expectHeading(page, /Add funds|Payment|method/i);
  });
  await act('Withdraw funds: press Proceed and read the outcome', [], async () => {
    await clickLink(page, 'Dashboard');
    await clickLink(page, 'Withdraw Funds');
    // Bank transfers are paused in this stack, so the page says so and Proceed stays disabled.
    await expect(page.getByText(/temporarily unavailable/i)).toBeVisible();
    await expect(button(page, /^Proceed/)).toBeDisabled();
    await expectHeading(page, /Withdraw/i);
  });
  for (const [label, heading] of [['Airtime', 'Buy Airtime'], ['Data', 'Buy Data'], ['Electricity', 'Pay Electricity'], ['TV/Cable', 'Buy TV/Cable']] as const) {
    await act(`${label}: press Proceed with an empty form and read the validation`, [], async () => {
      await clickLink(page, label);
      // Bill payments are paused in this stack: the page says so and Proceed is disabled until a product and recipient are chosen.
      await expect(page.getByText(/temporarily unavailable/i)).toBeVisible();
      await expect(button(page, /^Proceed/)).toBeDisabled();
      await expectHeading(page, heading);
    });
  }
  await act('Identity verification: press Verify identity with nothing entered', [], async () => {
    await clickLink(page, 'Settings');
    await link(page, /^Identity verification/).click();
    // The button stays disabled until a number is typed and the consent box is ticked.
    await expect(button(page, 'Verify identity')).toBeDisabled();
    await expectHeading(page, 'Identity verification');
  });
  await act('Bank info: press Add new bank', [], async () => {
    await clickLink(page, 'Settings');
    await link(page, /^Bank info/).click();
    await button(page, 'Add new bank').click();
    await expectHeading(page, /Bank info|bank/i);
  });
  await act('Report a transaction issue: submit empty', [], async () => {
    await clickLink(page, 'Settings');
    await link(page, /^Help centre/).click();
    await link(page, /^Report a transaction issue/).click();
    await button(page, 'Submit dispute').click();
    await expectHeading(page, 'Support');
  });
  await act('Organizer centre: name an organizer and press Create', [], async () => {
    await clickLink(page, 'Settings');
    await link(page, /^Organizer centre/).click();
    await typeLikeAPerson(page.locator('#organizer-name'), 'Walkthrough Events');
    await button(page, 'Create organizer').click();
    await expectHeading(page, 'Organizer centre');
  });
  await act('Notifications: press Mark all as read', [], async () => {
    await clickLink(page, 'Notifications');
    // Nothing to mark: the control is disabled at 0 unread.
    await expect(page.getByText('0 unread')).toBeVisible();
    await expect(button(page, 'Mark all as read')).toBeDisabled();
    await expectHeading(page, 'Notifications');
  });
  for (const label of ['Change password', 'Set transaction pin', 'Update phone number']) {
    await act(`Security settings: open "${label}" and close it again`, [], async () => {
      await clickLink(page, 'Settings');
      await link(page, /^Account security/).click();
      await link(page, /^Security settings/).click();
      await button(page, label).click();
      await expect(page.getByRole('alertdialog').or(page.getByRole('dialog')).first()).toBeVisible();
      await page.keyboard.press('Escape');
      await expectHeading(page, 'Security');
    });
  }
}
