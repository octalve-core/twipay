import { waitForTarget } from './stack-readiness.mjs';

const targets = [
  process.env.API_URL ? `${process.env.API_URL}/v1/health/live` : 'http://127.0.0.1:4000/v1/health/live',
  process.env.APP_URL ?? 'http://127.0.0.1:3000',
  process.env.ADMIN_URL ?? 'http://127.0.0.1:3001',
];
await Promise.all(targets.map((target) => waitForTarget(target)));
console.log('Stack readiness PASS');
