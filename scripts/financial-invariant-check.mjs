import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const schema = readFileSync(join(root, 'packages/database/prisma/schema.prisma'), 'utf8');
const migration = readFileSync(join(root, 'packages/database/prisma/migrations/0002_financial_core/migration.sql'), 'utf8');
const findings = [];

const walletModel = schema.match(/model Wallet \{([\s\S]*?)\n\}/)?.[1] ?? '';
if (/\bbalance(?:Minor)?\b/i.test(walletModel)) findings.push('Wallet model contains a mutable balance field; the ledger must remain source of truth');
for (const required of [
  'model LedgerAccount',
  'model JournalTransaction',
  'model JournalEntry',
  'model WalletHold',
  'model FinancialTransaction',
  'model IdempotencyRecord',
  'model ProviderOperation',
  'model ReconciliationCase',
]) {
  if (!schema.includes(required)) findings.push(`Prisma schema missing ${required}`);
}
for (const required of [
  'journal_entries_amount_positive',
  'journal_transactions_mutation_guard',
  'journal_insert_open_guard',
  'journal_sealed_commit_guard',
  'journal_entry_insert_guard',
  'journal_balance_guard',
  'wallet_hold_mutation_guard',
  'financial_transactions_mutation_guard',
  'wallet_ledger_binding_guard',
  'provider_operations_mutation_guard',
  'bank_transfers_mutation_guard',
  'UNIQUE ("userId","scope","key")',
  'journal_transactions_reversalOfId_key',
  'provider_operations_providerCode_type_providerReference_key',
  'provider_operations_one_pending_va_per_user',
  'accountNumberCiphertext',
  'accountNumberFingerprint',
]) {
  if (!migration.includes(required)) findings.push(`Financial migration missing database guard: ${required}`);
}


if (/model Beneficiary \{[\s\S]*?\baccountNumber\s+String\b/.test(schema)) findings.push('Beneficiary stores plaintext accountNumber');
if (/model VirtualAccount \{[\s\S]*?\baccountNumber\s+String\b/.test(schema)) findings.push('VirtualAccount stores plaintext accountNumber');
if (!schema.includes('@@unique([userId, providerCode, currency])')) findings.push('VirtualAccount lacks one-account-per-user/provider/currency guard');
if (!schema.includes('reversalOfId           String?               @unique')) findings.push('Journal reversal is not one-to-one at Prisma level');
if (/model IdempotencyRecord \{[\s\S]*?\bresponseBody\s+Json/.test(schema)) findings.push('Idempotency replay bodies are stored as plaintext JSON');
if (!schema.includes('responseBodyCiphertext')) findings.push('Idempotency replay bodies are not encrypted at rest');

const scanRoots = ['apps/api/src', 'apps/worker/src', 'packages'];
function walk(dir, cb) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.test-dist'].includes(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, cb);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) cb(p);
  }
}
for (const base of scanRoots) {
  const dir = join(root, base);
  walk(dir, (file) => {
    const text = readFileSync(file, 'utf8');
    const rel = relative(root, file);
    if (/wallet\s*\.\s*balance\s*(?:\+\+|--|[+\-*/]?=)/i.test(text)) findings.push(`${rel}: direct wallet balance mutation`);
    if (/\b(?:bvn|nin)\s*:\s*input\.identifier\b/i.test(text) && !rel.includes('packages/providers/')) {
      // Raw identifier may cross the provider boundary but must not be stored by TwiPay application code.
      findings.push(`${rel}: raw identity identifier appears outside provider adapter boundary`);
    }
  });
}


const webhookService = readFileSync(join(root, 'apps/api/src/modules/webhooks/application/webhook.service.ts'), 'utf8');
if (!webhookService.includes("status: { in: ['VERIFIED', 'FAILED'] }")) {
  findings.push('Webhook inbox does not permit atomically retrying previously failed signed events');
}
if (!webhookService.includes("event.status === 'PROCESSING'")) {
  findings.push('Webhook inbox does not guard concurrent duplicate processing');
}
if (!webhookService.includes("code: 'WEBHOOK_VERIFICATION_FAILED'")) {
  findings.push('Public webhook verification errors are not normalized to a non-leaking generic failure');
}


const transferService = readFileSync(join(root, 'apps/api/src/modules/finance/application/transfer.service.ts'), 'utf8');
if (!transferService.includes("const monetaryEvidenceRequired = input.result.status === 'SUCCEEDED' || input.result.status === 'REVERSED'")) {
  findings.push('Payout success/reversal does not require exact provider amount/currency evidence');
}
if (!transferService.includes("code: 'INSUFFICIENT_AVAILABLE_BALANCE'")) {
  findings.push('Deterministic insufficient-balance failures are not persisted into idempotency replay state');
}

const providerRegistry = readFileSync(join(root, 'apps/api/src/modules/providers/payment-provider.registry.ts'), 'utf8');
if (providerRegistry.includes("allowUnsignedSandboxWebhooks: process.env.NODE_ENV !== 'production'")) {
  findings.push('Monnify sandbox webhooks are implicitly unsigned outside production; explicit opt-in is required');
}
if (!providerRegistry.includes("MONNIFY_ALLOW_UNSIGNED_SANDBOX_WEBHOOKS === 'true'")) {
  findings.push('Explicit Monnify unsigned-sandbox webhook gate is missing');
}

const kycService = readFileSync(join(root, 'apps/api/src/modules/kyc/application/kyc.service.ts'), 'utf8');
if (!kycService.includes("verification.status === 'VERIFIED'")) {
  findings.push('KYC continuation does not short-circuit already verified identities');
}
if (!kycService.includes("status: 'VERIFIED'") || !kycService.includes('verifiedExisting')) {
  findings.push('KYC initiation does not reuse an already verified identity before billable provider calls');
}
if (!kycService.includes("KYC_VERIFICATION_EXPIRED")) {
  findings.push('KYC continuation does not enforce local verification expiry');
}

const idempotencyService = readFileSync(join(root, 'apps/api/src/modules/finance/application/idempotency.service.ts'), 'utf8');
if (!idempotencyService.includes('responseBodyCiphertext') || !idempotencyService.includes('encryptSensitiveString')) {
  findings.push('Idempotency replay responses are not encrypted at rest');
}

const financeController = readFileSync(join(root, 'apps/api/src/modules/finance/presentation/finance.controller.ts'), 'utf8');
for (const route of ["@Post('payments/collections')", "@Post('transfers')", "@Post('virtual-accounts')"]) {
  if (!financeController.includes(route)) findings.push(`Financial API missing expected critical route ${route}`);
}
if (!financeController.includes("@Headers('idempotency-key')")) findings.push('Critical financial controller does not enforce idempotency-key headers');

if (findings.length) {
  console.error('Financial invariant check FAILED:\n' + findings.map((x) => ` - ${x}`).join('\n'));
  process.exit(1);
}
console.log('Financial invariant check PASS');
