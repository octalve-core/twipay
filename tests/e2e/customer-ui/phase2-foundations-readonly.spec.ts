import {test,expect} from '@playwright/test';
/** Browser smoke for real ErhaPay/Vite customer app. NOT executed until Node24/browser services are available. */
test('new account foundations are protected from anonymous access',async({page})=>{
 const routes=[
  '/dashboard/settings/security-overview',
  '/dashboard/settings/beneficiaries',
  '/dashboard/settings/notification-preferences',
  '/dashboard/settings/support-centre',
  '/dashboard/my-tickets',
  '/dashboard/organizer',
 ];
 for(const route of routes){
  await page.goto(route);
  await expect(page).toHaveURL(/\/auth\/login$/);
  await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
 }
});
test('anonymous visitors cannot open saved beneficiaries through an encoded path',async({page})=>{
 await page.goto('/dashboard/settings/%62eneficiaries');
 await expect(page).toHaveURL(/\/auth\/login$/);
});
