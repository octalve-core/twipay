import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://twipay:development_password@127.0.0.1:5435/twipay?schema=public';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
test.after(async()=>prisma.$disconnect());

test('Batch 4 operational audit is append-only and deployment profile cannot be deleted',async()=>{
  const user=await prisma.user.create({data:{email:`ops-audit-${suffix}@example.com`,status:'ACTIVE'}});
  const event=await prisma.operationalAuditEvent.create({data:{actorUserId:user.id,action:'TEST_ACTION',targetType:'test',targetId:suffix}});
  await assert.rejects(prisma.operationalAuditEvent.update({where:{id:event.id},data:{action:'REWRITTEN'}}),/append-only/);
  const profile=await prisma.deploymentProfile.findUniqueOrThrow({where:{key:'default'}});
  assert.equal(profile.edition,'TWIPAY_OWNED');
  await assert.rejects(prisma.deploymentProfile.delete({where:{key:'default'}}),/cannot be deleted/);
});

test('Batch 4 provider offer cannot be remapped without explicit equivalence evidence',async()=>{
  const a=await prisma.billProduct.create({data:{code:`eq-a-${suffix}`,category:'DATA',name:'Equivalent A',customerIdentifierType:'PHONE',currency:'NGN',fixedAmountMinor:1000n}});
  const b=await prisma.billProduct.create({data:{code:`eq-b-${suffix}`,category:'DATA',name:'Equivalent B',customerIdentifierType:'PHONE',currency:'NGN',fixedAmountMinor:1000n}});
  const offer=await prisma.billProviderOffer.create({data:{productId:a.id,providerCode:`guard-${suffix}`.slice(0,40),providerProductCode:`sku-${suffix}`,providerBillerCode:`biller-${suffix}`}});
  await assert.rejects(prisma.billProviderOffer.update({where:{id:offer.id},data:{productId:b.id}}),/requires explicit equivalence verification/);
});

test('Batch 4 payout maker and checker cannot be the same person',async()=>{
  const user=await prisma.user.create({data:{email:`payout-mc-${suffix}@example.com`,status:'ACTIVE'}});
  const settlement=await prisma.ledgerAccount.create({data:{code:`payout-settlement-${suffix}`,name:'Payout settlement',category:'LIABILITY',normalBalance:'CREDIT',currency:'NGN',system:true}});
  const organizer=await prisma.eventOrganizer.create({data:{ownerUserId:user.id,name:'Maker checker org',slug:`mc-org-${suffix}`.slice(0,120),settlementLedgerAccountId:settlement.id}});
  const beneficiary=await prisma.beneficiary.create({data:{userId:user.id,currency:'NGN',bankCode:'001',accountNumberCiphertext:'cipher',accountNumberFingerprint:'c'.repeat(64),accountNumberLast4:'1234',accountName:'Test Beneficiary'}});
  const payout=await prisma.organizerPayout.create({data:{reference:`orgpay-${suffix}`.slice(0,100),organizerId:organizer.id,beneficiaryId:beneficiary.id,amountMinor:100n,currency:'NGN',providerCode:'paystack',narration:'Test payout',requestedByUserId:user.id}});
  await prisma.organizerPayout.update({where:{id:payout.id},data:{status:'PENDING_APPROVAL',preparedByUserId:user.id}});
  await assert.rejects(prisma.organizerPayout.update({where:{id:payout.id},data:{approvedByUserId:user.id}}),/maker and checker must be different/);
});

test('Batch 4 high-risk refund and organizer payout features are disabled by default',async()=>{
  const [refunds,payouts]=await Promise.all([
    prisma.featureFlag.findUniqueOrThrow({where:{key:'events.refunds'}}),
    prisma.featureFlag.findUniqueOrThrow({where:{key:'operations.organizer_payouts'}}),
  ]);
  assert.equal(refunds.enabled,false);
  assert.equal(payouts.enabled,false);
});

test('Batch 4 delegated event staff identity is immutable and revocation is one-way',async()=>{
  const owner=await prisma.user.create({data:{email:`staff-owner-${suffix}@example.com`,status:'ACTIVE'}});
  const staff=await prisma.user.create({data:{email:`staff-user-${suffix}@example.com`,status:'ACTIVE'}});
  const settlement=await prisma.ledgerAccount.create({data:{code:`staff-settlement-${suffix}`,name:'Staff settlement',category:'LIABILITY',normalBalance:'CREDIT',currency:'NGN',system:true}});
  const organizer=await prisma.eventOrganizer.create({data:{ownerUserId:owner.id,name:'Staff org',slug:`staff-org-${suffix}`.slice(0,120),settlementLedgerAccountId:settlement.id}});
  const event=await prisma.event.create({data:{organizerId:organizer.id,slug:`staff-event-${suffix}`.slice(0,120),title:'Staff event',currency:'NGN',startsAt:new Date(Date.now()+86400000)}});
  const assignment=await prisma.eventStaffAssignment.create({data:{eventId:event.id,userId:staff.id,role:'CHECK_IN',invitedByUserId:owner.id}});
  await assert.rejects(prisma.eventStaffAssignment.update({where:{id:assignment.id},data:{userId:owner.id}}),/instruction is immutable/);
  await prisma.eventStaffAssignment.update({where:{id:assignment.id},data:{status:'REVOKED'}});
  await assert.rejects(prisma.eventStaffAssignment.update({where:{id:assignment.id},data:{status:'ACTIVE'}}),/invalid event staff assignment transition/);
});
