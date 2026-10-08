import { isErhaPayCustomerShell, waitForTarget } from './stack-readiness.mjs';

const api = process.env.API_URL ?? 'http://127.0.0.1:4000';
const customer = process.env.APP_URL ?? 'http://127.0.0.1:3000';
const admin = process.env.ADMIN_URL ?? 'http://127.0.0.1:3001';
await Promise.all([
  waitForTarget(`${api}/v1/health/live`),
  waitForTarget(customer, {verifyResponse: async (response) => isErhaPayCustomerShell(await response.text())}),
  waitForTarget(admin),
]);
console.log('Stack readiness PASS (actual ErhaPay-derived customer shell confirmed)');
