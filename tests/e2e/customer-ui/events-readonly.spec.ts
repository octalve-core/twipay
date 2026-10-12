import {test,expect,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
/** Requires isolated running Vite customer app and TwiPay API with the event checkout flags OFF.
 * Screenshots are visual-regression baselines only; no financial mutations are executed.
 */
const email=process.env['TWIPAY_TEST_CUSTOMER_EMAIL'];
const password=process.env['TWIPAY_TEST_CUSTOMER_PASSWORD'];
async function login(page:Page){await page.goto('/auth/login');await page.getByLabel('Email',{exact:true}).fill(email!);await page.getByLabel('Password',{exact:true}).fill(password!);await page.getByRole('button',{name:'Log in',exact:true}).click();await expect(page).toHaveURL(/\/dashboard(?:\/)?$/);}
for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
 test(`events and customer operations stay read-only at ${viewport.width}x${viewport.height}`,async({page})=>{
  test.skip(!email||!password,'Requires disposable sandbox customer account credentials');
  test.skip(process.env['VITE_TWIPAY_EVENT_CHECKOUT_SANDBOX_ENABLED']==='true','Read-only audit must not enable checkout');
  await page.setViewportSize(viewport);
  await login(page);
  await page.goto('/dashboard/events');
  await expect(page.getByPlaceholder('Search events')).toBeVisible();
  await expect(page.getByText('My bookings')).toBeVisible();
  await expect(page.getByText('5ive listening party')).toHaveCount(0);
  mkdirSync('docs/tests/screenshots',{recursive:true});
  await page.screenshot({path:`docs/tests/screenshots/batch-e-events-${viewport.width}x${viewport.height}.png`,fullPage:true});
  await page.goto('/dashboard/notifications');
  await expect(page.getByText(/Delivery history for messages/)).toBeVisible();
  await page.screenshot({path:`docs/tests/screenshots/batch-e-notifications-${viewport.width}x${viewport.height}.png`,fullPage:true});
 });
}
