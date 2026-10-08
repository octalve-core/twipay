import {test, expect, type Page} from '@playwright/test';

/** Batch D browser smoke gate. Requires disposable customer credentials and a running API.
 * Runs READ-ONLY. No bill provider validation, wallet hold or purchase is triggered.
 * Default-off VITE_TWIPAY_BILLS_SANDBOX_ENABLED=false is mandatory for these tests.
 */
const email=process.env['TWIPAY_TEST_CUSTOMER_EMAIL'];
const password=process.env['TWIPAY_TEST_CUSTOMER_PASSWORD'];
async function login(page:Page){
  await page.goto('/auth/login');
  await page.getByLabel('Email',{exact:true}).fill(email!);
  await page.getByLabel('Password',{exact:true}).fill(password!);
  await page.getByRole('button',{name:'Log in',exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/)?$/);
}
for(const [route, title] of [
  ['airtime','Buy Airtime'],['data','Buy Data'],['electricity','Pay Electricity'],['cable','Buy TV/Cable']
] as const){
  test(`unqualified ${route} screen is visible but no purchase can be submitted`,async({page})=>{
    test.skip(!email || !password,'Requires disposable sandbox TWIPAY_TEST_CUSTOMER_EMAIL/PASSWORD');
    test.skip(process.env['TWIPAY_CUSTOMER_UI_BILLS_SANDBOX_ENABLED']==='true','Must run with disabled bill sandbox');
    await login(page);
    await page.goto(`/dashboard/services/${route}`);
    await expect(page.getByRole('heading',{name:title})).toBeVisible();
    await expect(page.getByText(/no money will be moved/i)).toBeVisible();
    await expect(page.getByRole('button',{name:/Proceed.*Verify details/i})).toBeDisabled();
    await expect(page.getByRole('button',{name:/Confirm purchase/i})).toHaveCount(0);
    await page.screenshot({path:`docs/tests/screenshots/batch-d-${route}-disabled.png`,fullPage:true});
  });
}
