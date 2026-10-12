import {test,expect} from '@playwright/test';
/** Read-only, negative access-control probe; requires an isolated real API. */
test('anonymous ticket credential request is rejected before any reveal', async ({request}) => {
  const apiUrl = process.env['TWIPAY_TEST_API_URL'];
  test.skip(!apiUrl, 'Requires live isolated TwiPay API URL');
  const response = await request.get(`${apiUrl}/v1/events/orders/evt-invalid/tickets/TWP-123456789012345678901234/credential`,{
    extraHTTPHeaders: {'Cache-Control':'no-store'},
  });
  expect(response.status()).toBe(401);
  expect(response.headers()['cache-control']).toContain('no-store');
});
