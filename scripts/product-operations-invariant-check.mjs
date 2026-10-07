import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const schema=read('packages/database/prisma/schema.prisma');
const migration=read('packages/database/prisma/migrations/0004_product_operations/migration.sql');
const refunds=read('apps/api/src/modules/operations/application/dispute-refund.service.ts');
const payouts=read('apps/api/src/modules/operations/application/organizer-payout.service.ts');
const providers=read('apps/api/src/modules/operations/application/provider-operations.service.ts');
const permissions=read('apps/api/src/modules/auth/presentation/permission.guard.ts');
const apiClient=read('apps/web/app/_lib/api.ts');
const authGuard=read('apps/api/src/modules/auth/presentation/session-auth.guard.ts');
const financeIdem=read('apps/api/src/modules/finance/application/idempotency.service.ts');
const compliance=read('apps/api/src/modules/operations/application/compliance.service.ts');
const productController=read('apps/api/src/modules/product/presentation/product.controller.ts');

const requirements=[
  [schema.includes('model OperationalAuditEvent'), 'operational audit model missing'],
  [schema.includes('model RefundRequest'), 'refund request model missing'],
  [schema.includes('model OrganizerPayout'), 'organizer payout model missing'],
  [schema.includes('model DeploymentProfile'), 'deployment/licensing profile missing'],
  [schema.includes('model EventStaffAssignment'), 'delegated event check-in assignment model missing'],
  [migration.includes("'events.refunds', FALSE"), 'event refund feature must default disabled'],
  [migration.includes("'operations.organizer_payouts', FALSE"), 'organizer payout feature must default disabled'],
  [migration.includes('operational audit events are append-only') || migration.includes('operational_audit'), 'append-only operational audit guard missing'],
  [migration.includes('maker and checker must be different') || migration.includes('preparedByUserId'), 'maker/checker database guard missing'],
  [migration.includes('offer remap requires verified equivalence') || migration.includes('bill_offer_equivalence_verifications'), 'verified SKU remap guard missing'],
  [migration.includes('deployment profile cannot be deleted'), 'deployment profile deletion guard missing'],
  [migration.includes('event staff assignment instruction is immutable'), 'event staff assignment database guard missing'],
  [refunds.includes('reverseWithTx'), 'refund must use compensating ledger reversal'],
  [refunds.includes("type: 'REFUND'"), 'refund must create financial transaction'],
  [refunds.includes('mfaSatisfied'), 'refund approval must enforce MFA in application layer'],
  [payouts.includes('assertMakerChecker'), 'payout maker/checker invariant missing'],
  [payouts.includes('mfaSatisfied'), 'payout approval must enforce MFA in application layer'],
  [payouts.includes('ORGANIZER_PAYOUT_PROVIDER_EVIDENCE_MISMATCH'), 'payout exact evidence mismatch path missing'],
  [providers.includes('SKU_EQUIVALENCE_REQUIRES_EXACT_PRODUCT_SEMANTICS'), 'SKU mapping must reject guessed equivalence'],
  [permissions.includes('RequirePermissions'), 'permission guard missing'],
  [authGuard.includes('isRecentMfaAssurance'), 'MFA assurance must be time-bounded'],
  [productController.includes("['events.refunds', 'operations.organizer_payouts'].includes(body.key)") && productController.includes('requireMfa(req)'), 'high-risk feature activation must require recent MFA'],
  [financeIdem.includes('releaseProcessing'), 'transient idempotency release path missing'],
  [!compliance.includes('identifierCiphertext: true') && !compliance.includes('result: true'), 'compliance API must not select encrypted identity/raw provider result'],
  [apiClient.includes("'x-csrf-token'"), 'customer mutation helper must send CSRF token'],
  [!apiClient.includes('localStorage'), 'customer API helper must not use localStorage authentication'],
];
const failures=requirements.filter(([ok])=>!ok).map(([,m])=>m);
if(failures.length){for(const f of failures)console.error(`FAIL: ${f}`);process.exit(1)}
console.log('Product/operations invariant check PASS');
