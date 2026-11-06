import { expect } from '@playwright/test';
import { freshCode } from '../lib/authenticator.js';
import { typeLikeAPerson } from '../lib/human.js';
import { readEmailedCode } from '../lib/inbox.js';
import { authBudget } from '../lib/pace.js';
import { button, clearAndType, clickLink, expectHeading, link, signInCustomer } from '../lib/ui.js';
import type { World } from '../lib/world.js';

// Chapter 2: customer Ada from sign-up to every dashboard page.
export async function customerSignUp(w: World): Promise<void> {
  const { page, step } = w;
  const ada = w.people['ada']!;
  await step({ chapter: 'Customer: sign up', role: 'customer Ada', name: 'Open the sign-up form', covers: [] }, async () => {
    await clickLink(page, 'Sign up');
    await expect(page).toHaveURL(/\/auth\/signup/);
  });
  await step({ chapter: 'Customer: sign up', role: 'customer Ada', name: 'Submit it empty: each field explains itself', covers: [] }, async () => {
    await button(page, 'Create account').click();
    await expect(page.getByRole('alert').first()).toBeVisible();
  });
  await step({ chapter: 'Customer: sign up', role: 'customer Ada', name: 'Try a password that is too short', covers: [] }, async () => {
    await typeLikeAPerson(page.locator('#firstname'), ada.given);
    await typeLikeAPerson(page.locator('#lastname'), ada.family);
    await typeLikeAPerson(page.locator('#email'), ada.email);
    await typeLikeAPerson(page.locator('#password'), 'short1');
    await authBudget(page);
    await button(page, 'Create account').click();
    await expect(page.getByRole('alert').first()).toBeVisible();
  });
  await step({ chapter: 'Customer: sign up', role: 'customer Ada', name: 'Register with a proper password', covers: ['C10'] }, async () => {
    await clearAndType(page.locator('#password'), ada.password);
    await authBudget(page);
    await button(page, 'Create account').click();
    await expect(page).toHaveURL(/\/auth\/verify-email/);
  });
  await step({ chapter: 'Customer: sign up', role: 'customer Ada', name: 'Enter a wrong verification code and read the message', covers: [] }, async () => {
    await typeLikeAPerson(page.locator('#email-otp'), '000000');
    await button(page, 'Verify and continue').click();
    await expect(page.getByText('That code is invalid or expired')).toBeVisible();
    await expect(page.locator('#email-otp')).toHaveValue('');
  });
  await step({ chapter: 'Customer: sign up', role: 'customer Ada', name: 'Read the emailed code in the dev inbox and enter it', covers: ['C11'] }, async () => {
    const code = await readEmailedCode(page, ada.email, 'Verify your TwiPay email');
    await typeLikeAPerson(page.locator('#email-otp'), code);
    await button(page, 'Verify and continue').click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
  await step({ chapter: 'Customer: sign up', role: 'customer Ada', name: 'Land on the dashboard', covers: ['C20'] }, async () => {
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Ada/ })).toBeVisible();
  });
}

interface Stop { name: string; covers: string[]; go: () => Promise<void>; heading: string | RegExp }

// Chapter 3: every page a signed-in customer can reach, by clicking sidebar links, dashboard tiles and settings cards.
export async function customerTour(w: World): Promise<void> {
  const { page, step } = w;
  const side = (name: string | RegExp) => async () => { await clickLink(page, name); };
  const stops: Stop[] = [
    { name: 'History', covers: ['C21'], go: side('History'), heading: 'History' },
    { name: 'Dashboard, then Add Funds', covers: ['C23'], go: async () => { await clickLink(page, 'Dashboard'); await clickLink(page, 'Add Funds'); }, heading: 'Add funds' },
    { name: 'Dashboard, then Withdraw Funds', covers: ['C25'], go: async () => { await clickLink(page, 'Dashboard'); await clickLink(page, 'Withdraw Funds'); }, heading: 'Withdraw funds' },
    { name: 'Dashboard, then Static Account', covers: ['C24'], go: async () => { await clickLink(page, 'Dashboard'); await clickLink(page, 'Static Account'); }, heading: /static account/i },
    { name: 'Services', covers: ['C26'], go: side('Services'), heading: 'Services' },
    { name: 'Services again: none of the deferred features are offered', covers: ['C49'], go: async () => { await clickLink(page, 'Services'); await expect(page.getByText(/e-?pin|e-?sim|mobile money|flight|hotel|virtual card|referral|affiliate|transfer funds/i)).toHaveCount(0); }, heading: 'Services' },
    { name: 'Airtime', covers: ['C27'], go: side('Airtime'), heading: 'Buy Airtime' },
    { name: 'Data', covers: ['C28'], go: side('Data'), heading: 'Buy Data' },
    { name: 'Electricity', covers: ['C29'], go: side('Electricity'), heading: 'Pay Electricity' },
    { name: 'TV/Cable', covers: ['C30'], go: side('TV/Cable'), heading: 'Buy TV/Cable' },
    { name: 'Dashboard, then Events Tickets', covers: ['C31'], go: async () => { await clickLink(page, 'Dashboard'); await clickLink(page, 'Events Tickets'); }, heading: 'Select Events' },
    { name: 'Notifications', covers: ['C32'], go: side('Notifications'), heading: 'Notifications' },
    { name: 'Notification preferences', covers: ['C42'], go: side('Preferences'), heading: 'Notification preferences' },
    { name: 'Settings', covers: ['C33'], go: side('Settings'), heading: 'Settings' },
    { name: 'Account', covers: ['C34'], go: async () => { await link(page, /^Account\s+View and make changes/).click(); }, heading: 'Account' },
    { name: 'Settings, then Identity verification', covers: ['C35'], go: async () => { await clickLink(page, 'Settings'); await link(page, /^Identity verification/).click(); }, heading: 'Identity verification' },
    { name: 'Settings, then Account security', covers: ['C40'], go: async () => { await clickLink(page, 'Settings'); await link(page, /^Account security/).click(); }, heading: 'Account security' },
    { name: 'Security settings', covers: ['C36'], go: async () => { await link(page, /^Security settings/).click(); }, heading: 'Security' },
    { name: 'Settings, then Bank info', covers: ['C37'], go: async () => { await clickLink(page, 'Settings'); await link(page, /^Bank info/).click(); }, heading: 'Bank info' },
    { name: 'Settings, then Help centre', covers: ['C43'], go: async () => { await clickLink(page, 'Settings'); await link(page, /^Help centre/).click(); }, heading: 'Help and support' },
    { name: 'Report a transaction issue', covers: ['C38'], go: async () => { await link(page, /^Report a transaction issue/).click(); }, heading: 'Support' },
    { name: 'Settings, then Saved beneficiaries', covers: ['C41'], go: async () => { await clickLink(page, 'Settings'); await link(page, /^Saved beneficiaries/).click(); }, heading: 'Saved beneficiaries' },
    { name: 'Settings, then My tickets', covers: ['C44'], go: async () => { await clickLink(page, 'Settings'); await link(page, /^My tickets/).click(); }, heading: 'My tickets' },
    { name: 'Settings, then Organizer centre', covers: ['C45'], go: async () => { await clickLink(page, 'Settings'); await link(page, /^Organizer centre/).click(); }, heading: 'Organizer centre' },
    { name: 'Event check-in', covers: ['C46'], go: async () => { await link(page, /^Event check-in/).click(); }, heading: 'Event check-in' },
  ];
  for (const stop of stops) {
    await step({ chapter: 'Customer: every page', role: 'customer Ada', name: `Open ${stop.name}`, covers: stop.covers }, async () => {
      await stop.go();
      await expectHeading(page, stop.heading);
    });
  }
}

// Chapter 4: settings that must persist, a support request, then leave and come back.
export async function customerSettings(w: World): Promise<void> {
  const { page, step } = w;
  await step({ chapter: 'Customer: settings', role: 'customer Ada', name: 'Change the state on the account page and save', covers: [] }, async () => {
    await clickLink(page, 'Settings');
    await link(page, /^Account\s+View and make changes/).click();
    await clearAndType(page.locator('#state'), 'Lagos');
    await button(page, 'Save').click();
    await expect(page.getByText('Profile updated successfully')).toBeVisible();
  });
  await step({ chapter: 'Customer: settings', role: 'customer Ada', name: 'Leave and come back: the state is still Lagos', covers: [] }, async () => {
    await clickLink(page, 'Dashboard');
    await clickLink(page, 'Account settings');
    await expect(page.locator('#state')).toHaveValue('Lagos');
  });
  await step({ chapter: 'Customer: settings', role: 'customer Ada', name: 'Turn a notification preference off and save', covers: [] }, async () => {
    await clickLink(page, 'Notifications');
    await clickLink(page, 'Preferences');
    await page.getByRole('checkbox').first().click();
    await button(page, 'Save preferences').click();
    await expect(page.getByText(/preferences/i).filter({ hasText: /saved|updated/i }).first()).toBeVisible();
  });
  await step({ chapter: 'Customer: settings', role: 'customer Ada', name: 'Leave and come back: the preference stayed changed', covers: [] }, async () => {
    await clickLink(page, 'Dashboard');
    await clickLink(page, 'Notifications');
    await clickLink(page, 'Preferences');
    await expect(page.getByRole('checkbox').first()).not.toBeChecked();
  });
  await step({ chapter: 'Customer: settings', role: 'customer Ada', name: 'Open a support request from Help centre', covers: [] }, async () => {
    await clickLink(page, 'Settings');
    await link(page, /^Help centre/).click();
    await page.locator('#support-category').selectOption({ label: 'Technical help' });
    await typeLikeAPerson(page.locator('#support-subject'), 'Cannot see my history');
    await typeLikeAPerson(page.locator('#support-message'), 'My transaction history page stays empty after I signed up.');
    await button(page, 'Send request').click();
    await expect(page.getByText('Cannot see my history').first()).toBeVisible();
  });
}

// Chapter 5: password reset and two-factor, each followed by a fresh sign-in.
export async function customerSecurity(w: World): Promise<void> {
  const { page, step } = w;
  const ada = w.people['ada']!;
  await step({ chapter: 'Customer: security', role: 'customer Ada', name: 'Log out for real', covers: ['C15'] }, async () => {
    await clickLink(page, 'Settings');
    await button(page, /^Log out/).click();
    await expect(page.getByRole('heading', { name: 'Log out?' })).toBeVisible();
    await button(page, 'No, Cancel').click();
    await button(page, /^Log out/).click();
    await button(page, 'Yes, Logout').click();
    await expect(page.getByText('Logged out.')).toBeVisible();
  });
  await step({ chapter: 'Customer: security', role: 'customer Ada', name: 'Press Back: the dashboard is not shown to a signed-out person', covers: ['C16'] }, async () => {
    await page.goBack();
    await expect(page).not.toHaveURL(/\/dashboard$/);
  });
  await step({ chapter: 'Customer: security', role: 'customer Ada', name: 'Sign in with a wrong password and read the message', covers: ['C13'] }, async () => {
    await typeLikeAPerson(page.locator('#email'), ada.email);
    await typeLikeAPerson(page.locator('#password'), 'Not-the-right-pass-1');
    await authBudget(page);
    await button(page, 'Log in').click();
    await expect(page.getByText('Incorrect email or password.')).toBeVisible();
  });
  await step({ chapter: 'Customer: security', role: 'customer Ada', name: 'Forgot password: request a code and set a new password', covers: ['C14'] }, async () => {
    await clickLink(page, 'Forgot password?');
    await typeLikeAPerson(page.locator('#email'), ada.email);
    await page.getByRole('button', { name: 'Send code' }).click();
    const code = await readEmailedCode(page, ada.email, 'password', 120_000);
    await typeLikeAPerson(page.locator('#reset-code'), code);
    await button(page, /^Proceed/).click();
    ada.password = `${ada.password}-new`;
    await typeLikeAPerson(page.getByPlaceholder('Enter a new password'), ada.password);
    await typeLikeAPerson(page.getByPlaceholder('Confirm your new password'), ada.password);
    await button(page, 'Reset password').click();
    await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
  });
  await step({ chapter: 'Customer: security', role: 'customer Ada', name: 'Sign in with the new password', covers: ['C12'] }, async () => {
    await clickLink(page, 'Go to log in');
    await signInCustomer(page, ada);
    await expect(page).toHaveURL(/\/dashboard/);
  });
  await step({ chapter: 'Customer: security', role: 'customer Ada', name: 'Enable two-factor authentication with the simulated authenticator app', covers: [] }, async () => {
    await clickLink(page, 'Settings');
    await link(page, /^Account security/).click();
    await link(page, /^Security settings/).click();
    await button(page, 'Enable 2FA').click();
    await typeLikeAPerson(page.locator('#mfa-password'), ada.password);
    await button(page, 'Set up authenticator').click();
    const secret = (await page.getByLabel('Authenticator setup secret').innerText()).trim();
    await typeLikeAPerson(page.locator('#mfa-code'), await freshCode(page, secret));
    await button(page, 'Confirm authenticator').click();
    await expect(page.getByLabel('One-time MFA recovery codes')).toBeVisible();
    w.secrets['ada'] = secret;
    await button(page, 'I have saved my codes').click();
  });
  await step({ chapter: 'Customer: security', role: 'customer Ada', name: 'Log out and sign in again: the authenticator code is asked for', covers: ['C17'] }, async () => {
    await clickLink(page, 'Settings');
    await button(page, /^Log out/).click();
    await button(page, 'Yes, Logout').click();
    await signInCustomer(page, ada);
    await expect(page).toHaveURL(/two-factor-authentication/);
    await typeLikeAPerson(page.locator('input[data-input-otp]'), await freshCode(page, w.secrets['ada']!));
    await button(page, /^Verify and continue/).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
}
