import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { publicCheckoutResponse } from '../../apps/api/src/modules/events/application/event-response.ts';
const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('legacy idempotency checkout replay removes bearer QR payloads without modifying original', () => {
  const old = { reference: 'evt-1', status: 'PAID', tickets: [
    {publicCode:'TWP-001',ticketTypeId:'type-1',qrPayload:'twipay-ticket:v1:private:secret',credentialCiphertext:'cipher'},
    {publicCode:'TWP-002',ticketTypeId:'type-2',qrPayload:'other-secret'}]};
  const result = publicCheckoutResponse(old);
  assert.deepEqual(result.tickets, [
    {publicCode:'TWP-001',ticketTypeId:'type-1'}, {publicCode:'TWP-002',ticketTypeId:'type-2'}]);
  assert.equal(result.reference, 'evt-1');
  assert.equal(old.tickets[0].qrPayload, 'twipay-ticket:v1:private:secret');
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('untrusted legacy ticket fields are dropped from idempotency replay', () => {
  const result=publicCheckoutResponse({tickets:[{qrPayload:'secret'},null, 'unexpected', 123]});
  assert.deepEqual(result.tickets,[{},{},{},{}]);
});

test('ordinary event order listing/detail and checkout never include decrypted credential', () => {
  const svc=read('apps/api/src/modules/events/application/event.service.ts');
  const general=svc.slice(svc.indexOf('async getOrderForUser'), svc.indexOf('async getTicketCredentialForUser'));
  const checkout=svc.slice(svc.indexOf('async checkout('), svc.indexOf('async checkoutIntentStatus'));
  assert.doesNotMatch(general,/decryptSensitiveString|qrPayload/);
  assert.match(checkout,/publicCheckoutResponse\(idem\.replay\.body\)/);
  assert.doesNotMatch(checkout,/issued\.map\(.*qrPayload/);
  assert.doesNotMatch(checkout,/issued\.push\(\{[^\n]*qrPayload/);
});

test('credential retrieval requires owner paid order and active ticket',()=>{
  const svc=read('apps/api/src/modules/events/application/event.service.ts');
  const narrow=svc.slice(svc.indexOf('async getTicketCredentialForUser'),svc.indexOf('async assignCheckInStaff'));
  assert.match(narrow,/where: \{ userId, reference, status: 'PAID' \}/);
  assert.match(narrow,/where: \{ orderId: order\.id, publicCode, status: 'ACTIVE' \}/);
  assert.match(narrow,/EVENT_TICKET_NOT_FOUND/);
  assert.match(narrow,/decryptSensitiveString/);
});

test('sensitive endpoint is authenticated, sandbox-only, input-bounded and no-store',()=>{
  const ctl=read('apps/api/src/modules/events/presentation/events.controller.ts');
  const route=ctl.slice(ctl.indexOf("@Get('orders/:reference/tickets/:publicCode/credential')"), ctl.indexOf("@Post(':eventId/staff')"));
  assert.match(route,/@UseGuards\(SessionAuthGuard\)/);
  assert.match(route,/assertTicketAdmissionSandbox\(\)/);
  const admissionGate=ctl.slice(ctl.indexOf('function assertTicketAdmissionSandbox'),ctl.indexOf('function serializeEvent'));
  assert.match(admissionGate,/NODE_ENV'\] === 'production'/);
  assert.match(admissionGate,/EVENT_TICKET_QR_SANDBOX_ENABLED/);
  assert.match(route,/principal\.userId/);
  assert.match(route,/Cache-Control', 'no-store, private, max-age=0'/);
  assert.match(read('.env.example'),/EVENT_TICKET_QR_SANDBOX_ENABLED=false/);
  assert.match(read('apps/api/src/platform/config/env.ts'),/EVENT_TICKET_QR_SANDBOX_ENABLED/);
});

test('void PostgreSQL advisory locks use executeRaw, not queryRaw',()=>{
  for(const p of ['apps/api/src/modules/finance/application/payment.service.ts','apps/api/src/modules/events/application/event.service.ts']){
    const source=read(p);
    assert.match(source,/\$executeRaw`SELECT pg_advisory_xact_lock\(/);
    assert.doesNotMatch(source,/\$queryRaw`SELECT pg_advisory_xact_lock\(/);
  }
});

test('ticket credential integrity is verified and reads are recorded without storing the secret',()=>{
  const svc=read('apps/api/src/modules/events/application/event.service.ts');
  const narrow=svc.slice(svc.indexOf('async getTicketCredentialForUser'),svc.indexOf('async assignCheckInStaff'));
  assert.match(narrow,/parseAndVerifyTicketCredential\(qrPayload, ticket\.credentialFingerprint, key\)/);
  assert.match(narrow,/ticket\.credentialKeyVersion/);
  assert.match(narrow,/operationalAuditEvent\.create/);
  assert.match(narrow,/EVENT_TICKET_CREDENTIAL_VIEWED/);
  assert.doesNotMatch(narrow,/afterState:\s*\{\s*qrPayload|beforeState:\s*\{\s*qrPayload/);
  const detail=svc.slice(svc.indexOf('async getOrderForUser'),svc.indexOf('async getTicketCredentialForUser'));
  assert.match(detail,/tickets: \{ select: \{ publicCode: true, status: true \} \}/);
});
