import {test,expect} from '@playwright/test';
/** Read-only, anonymous route smoke for the real ErhaPay/Vite app; requires a running build. */
test('receipt and incomplete MFA challenge redirect anonymous visitors to login',async({page})=>{
  for(const path of ['/receipt?txnId=opaque-reference','/auth/two-factor-authentication']){
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
  }
});
test('direct deferred/email-transfer URLs never load the legacy service screen',async({page})=>{
  for(const path of ['/dashboard/transfer-funds','/dashboard/services/%65pin','/dashboard/virtual-card/details']){
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
  }
});
test('legacy fake transaction success route cannot display a success message',async({page})=>{
  await page.goto('/dashboard/status?txnId=unverified');
  await expect(page.getByText('Your transfer of ₦')).toHaveCount(0);
  await expect(page).toHaveURL(/\/auth\/login$/);
});
test('provider funding callback is informational even with success-looking query parameters',async({page})=>{
  await page.goto('/wallet/fund/complete?status=SUCCESSFUL&reference=unverified');
  await expect(page.getByText(/does not confirm payment/i)).toBeVisible();
  await expect(page.getByText(/100,000/)).toHaveCount(0);
});
