import { expect } from '@playwright/test';
import { firstLoad } from '../lib/nav.js';
import { clickLink, expectHeading, link } from '../lib/ui.js';
import type { World } from '../lib/world.js';

// Chapter 1: a brand-new visitor, no account. Everything after the first load is a click.
export async function visitorChapter(w: World): Promise<void> {
  const { page, step } = w;
  await firstLoad(page, w.ui);
  await step({ chapter: 'Visitor', role: 'visitor', name: 'Open the landing page', covers: ['C01'] }, async () => {
    await expect(link(page, 'About us')).toBeVisible();
    await expect(link(page, 'Sign up')).toBeVisible();
  });
  await step({ chapter: 'Visitor', role: 'visitor', name: 'Open About us', covers: ['C02'] }, async () => {
    await clickLink(page, 'About us');
    await expect(page).toHaveURL(/\/about$/);
  });
  await step({ chapter: 'Visitor', role: 'visitor', name: 'Open Contact us and read the notice that the form cannot send', covers: ['C03'] }, async () => {
    await clickLink(page, 'Contact us');
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByRole('status').filter({ hasText: 'We can’t receive messages through this form right now' })).toBeVisible();
  });
  await step({ chapter: 'Visitor', role: 'visitor', name: 'Follow the privacy policy link from the contact form', covers: ['C05'] }, async () => {
    await clickLink(page, 'privacy policy.');
    await expect(page).toHaveURL(/\/privacy-policy$/);
  });
  await step({ chapter: 'Visitor', role: 'visitor', name: 'Open FAQs and wait for the questions (FINDING: there are none)', covers: ['C04'] }, async () => {
    await clickLink(page, 'FAQs');
    await expect(page).toHaveURL(/\/faqs$/);
    await expect(page.getByText('No FAQs available')).toBeVisible({ timeout: 30_000 });
  });
  await step({ chapter: 'Visitor', role: 'visitor', name: 'Return Home', covers: [] }, async () => {
    await clickLink(page, 'Home');
    await expect(page).toHaveURL(new RegExp(`${w.ui.replace(/[.:/]/g, '\\$&')}/?$`));
    await expectHeading(page, /./);
  });
}
