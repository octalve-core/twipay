import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const findings = [];
const mustExist = [
  'packages/services/src/index.ts',
  'packages/events/src/index.ts',
  'apps/api/src/modules/services/application/bill.service.ts',
  'apps/api/src/modules/events/application/event.service.ts',
  'apps/api/src/modules/notifications/application/notification.service.ts',
  'packages/database/prisma/migrations/0003_services_events/migration.sql',
  'apps/worker/src/main.ts',
];
for (const rel of mustExist) if (!existsSync(join(root, rel))) findings.push(`missing ${rel}`);

function text(rel) { return readFileSync(join(root, rel), 'utf8'); }
const schema = text('packages/database/prisma/schema.prisma');
const migration = text('packages/database/prisma/migrations/0003_services_events/migration.sql');
const bills = text('apps/api/src/modules/services/application/bill.service.ts');
const events = text('apps/api/src/modules/events/application/event.service.ts');
const worker = text('apps/worker/src/main.ts');
const notifications = text('apps/api/src/modules/notifications/application/notification.service.ts');

for (const model of ['BillProduct','BillProviderOffer','BillPurchase','ProviderCapabilityHealth','EventOrganizer','Event','EventTicketType','EventOrder','EventOrderItem','EventTicket','TicketCheckIn','Notification','NotificationAttempt']) {
  if (!schema.includes(`model ${model} {`)) findings.push(`Prisma schema missing ${model}`);
}
if (/model Wallet[\s\S]*?\bbalance\b/i.test(schema)) findings.push('Wallet must not regain mutable balance field');
for (const field of ['customerIdentifierCiphertext','fulfillmentCiphertext','credentialCiphertext','destinationCiphertext','bodyCiphertext']) {
  if (!schema.includes(field)) findings.push(`encrypted-at-rest field missing: ${field}`);
}
if (!schema.includes('credentialKeyVersion')) findings.push('tickets must persist signing key version for rotation');
if (!migration.includes('"priceMinor" > 0')) findings.push('V1 ticket prices must reject zero until free-ticket accounting is explicitly designed');
if (/OLD\."status"='PAID'\s+AND\s+NEW\."status"='REFUNDED'/.test(migration)) findings.push('event refund transition enabled without atomic compensating ledger workflow');
if (/OLD\."status"='ACTIVE'\s+AND\s+NEW\."status" IN \([^)]*'REFUNDED'/.test(migration)) findings.push('ticket refund transition enabled without refund workflow');
if (!migration.includes('event order items are immutable')) findings.push('event order item immutability guard missing');
if (!migration.includes("OLD.\"type\" = 'EVENT_PURCHASE'")) findings.push('internal FUNDS_RESERVED -> SUCCEEDED transition not restricted to EVENT_PURCHASE');
if (!migration.includes('journal_transactions') || !migration.includes('event order cannot become paid before financial settlement')) findings.push('event settlement database guard must require posted journal + succeeded financial transaction');
if (!bills.includes('never automatically routed') || !bills.includes('same provider')) findings.push('post-submission no-failover safety rule missing from bill flow');
if (!bills.includes('IdempotencyService') || !events.includes('IdempotencyService')) findings.push('bill/event flows must use user-scoped idempotency service');
if (!worker.includes("@twipay/api/worker-entry")) findings.push('worker must reuse API application services via worker-entry');
if (!notifications.includes('destinationCiphertext') || !notifications.includes('bodyCiphertext')) findings.push('notification PII/content must be encrypted at rest');
if (!events.includes('credentialKeyVersion') || !events.includes('TICKET_SIGNING_KEYS_JSON')) findings.push('ticket signing-key rotation support missing');
if (!bills.includes('BILL_RECONCILE_MAX_ATTEMPTS') || !notifications.includes('NOTIFICATION_MAX_ATTEMPTS')) findings.push('bounded retry policy missing');

if (!schema.includes('providerRequestReference      String')) findings.push('bill purchases must persist provider request reference before submission');
if (!migration.includes('bill purchase provider request reference is required before submission')) findings.push('database must require pre-submission bill provider request reference');
if (!migration.includes('bill purchase financial instruction mismatch')) findings.push('bill purchase insert financial consistency guard missing');
if (!migration.includes('event order financial instruction mismatch')) findings.push('event order insert financial consistency guard missing');
if (!migration.includes('event order financial fee mismatch')) findings.push('event order insert must match immutable financial fee');
if (!migration.includes('event order item price snapshot mismatch')) findings.push('event order item insert price/event guard missing');
if (!migration.includes('event ticket issuance exceeds purchased quantity')) findings.push('ticket issuance quantity guard missing');
if (!migration.includes('only active tickets may be checked in')) findings.push('ticket check-in state guard missing');
if (!bills.includes('createPurchaseRequestReference') || !bills.includes('providerRequestReference,')) findings.push('bill flow must allocate and persist provider query reference before network submission');

if (findings.length) {
  console.error('Services/events invariant check FAILED:\n' + findings.map((x) => ` - ${x}`).join('\n'));
  process.exit(1);
}
console.log('Services/events invariant check PASS');
