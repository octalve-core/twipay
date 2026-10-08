import http from 'k6/http';
import { check, sleep } from 'k6';

const api = (__ENV.API_URL || '').replace(/\/$/, '');
if (!api.startsWith('https://')) throw new Error('API_URL must be an approved HTTPS staging API');

export const options = {
  scenarios: {
    public_reads: { executor: 'constant-vus', vus: 10, duration: '30s', exec: 'publicReads' },
    webhook_shape_pressure: { executor: 'constant-arrival-rate', rate: 20, timeUnit: '1s', duration: '20s', preAllocatedVUs: 10, maxVUs: 50, exec: 'unauthenticatedGuards' },
  },
  thresholds: { http_req_failed: ['rate<0.02'], http_req_duration: ['p(95)<750'] },
};

export function publicReads() {
  const health = http.get(`${api}/v1/health/live`);
  check(health, { 'health non-5xx': (r) => r.status < 500 });
  const events = http.get(`${api}/v1/events`);
  check(events, { 'events non-5xx': (r) => r.status < 500 });
  sleep(0.2);
}

export function unauthenticatedGuards() {
  const response = http.post(`${api}/v1/auth/mfa/challenge`, JSON.stringify({ code: '000000' }), {
    headers: { 'content-type': 'application/json', origin: 'https://attacker.invalid' },
  });
  check(response, { 'malicious mutation rejected': (r) => r.status === 401 || r.status === 403 || r.status === 429 });
}
