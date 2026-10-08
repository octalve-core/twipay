import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://twipay:development_password@127.0.0.1:5435/twipay?schema=public';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const hash = (seed) => crypto.createHash('sha256').update(`${suffix}-${seed}`).digest('hex');
test.after(async()=>prisma.$disconnect());

async function user(label){return prisma.user.create({data:{email:`${label}-${suffix}@example.com`,status:'ACTIVE'}})}

test('Batch 5 sessions enforce immutable identity/assurance and one-way lifecycle',async()=>{
  const u=await user('session');
  const session=await prisma.session.create({data:{userId:u.id,tokenHash:hash('session-a'),csrfTokenHash:hash('session-b'),expiresAt:new Date(Date.now()+3600000)}});
  await prisma.session.update({where:{id:session.id},data:{lastSeenAt:new Date()}});
  await assert.rejects(prisma.session.update({where:{id:session.id},data:{mfaSatisfiedAt:new Date()}}),/rotate the session instead/);
  await assert.rejects(prisma.session.update({where:{id:session.id},data:{tokenHash:hash('session-c')}}),/immutable/);
  await prisma.session.update({where:{id:session.id},data:{status:'REVOKED',revokedAt:new Date(),revokeReason:'TEST'}});
  await assert.rejects(prisma.session.update({where:{id:session.id},data:{status:'ACTIVE'}}),/Invalid TwiPay session transition/);
  await assert.rejects(prisma.session.delete({where:{id:session.id}}),/cannot be deleted/);
});

test('Batch 5 MFA credential is auditable, secret-immutable and TOTP timestep is strictly monotonic',async()=>{
  const u=await user('mfa');
  const credential=await prisma.mfaCredential.create({data:{userId:u.id,secretCiphertext:'encrypted-test-value'}});
  await assert.rejects(prisma.mfaCredential.update({where:{id:credential.id},data:{secretCiphertext:'rewritten'}}),/secret is immutable/);
  await prisma.mfaCredential.update({where:{id:credential.id},data:{status:'ACTIVE',enabledAt:new Date(),lastAcceptedTimeStep:100n}});
  await assert.rejects(prisma.mfaCredential.update({where:{id:credential.id},data:{lastAcceptedTimeStep:100n}}),/timestep must advance/);
  await assert.rejects(prisma.mfaCredential.update({where:{id:credential.id},data:{lastAcceptedTimeStep:null}}),/timestep must advance/);
  await prisma.mfaCredential.update({where:{id:credential.id},data:{lastAcceptedTimeStep:101n}});
  await assert.rejects(prisma.mfaCredential.delete({where:{id:credential.id}}),/cannot be deleted/);
  await assert.rejects(prisma.mfaCredential.create({data:{userId:u.id,secretCiphertext:'second-current'}}),/unique|duplicate/i);
});

test('Batch 5 recovery codes are one-way consumed and cannot be deleted/reset',async()=>{
  const u=await user('recovery');
  const credential=await prisma.mfaCredential.create({data:{userId:u.id,secretCiphertext:'encrypted-test-value'}});
  const recovery=await prisma.mfaRecoveryCode.create({data:{credentialId:credential.id,codeHash:hash('recovery-d')}});
  const usedAt=new Date();
  await prisma.mfaRecoveryCode.update({where:{id:recovery.id},data:{usedAt}});
  await assert.rejects(prisma.mfaRecoveryCode.update({where:{id:recovery.id},data:{usedAt:null}}),/cannot be replayed or reset/);
  await assert.rejects(prisma.mfaRecoveryCode.delete({where:{id:recovery.id}}),/cannot be deleted/);
});

test('Batch 5 security event evidence is append-only',async()=>{
  const u=await user('security-event');
  const event=await prisma.securityEvent.create({data:{userId:u.id,type:'MFA_ENROLLMENT_STARTED',metadata:{test:true}}});
  await assert.rejects(prisma.securityEvent.update({where:{id:event.id},data:{metadata:{test:false}}}),/append-only/);
  await assert.rejects(prisma.securityEvent.delete({where:{id:event.id}}),/append-only/);
});

test('Batch 5 release keeps high-risk flags fail-closed',async()=>{
  const [refunds,payouts]=await Promise.all([
    prisma.featureFlag.findUniqueOrThrow({where:{key:'events.refunds'}}),
    prisma.featureFlag.findUniqueOrThrow({where:{key:'operations.organizer_payouts'}}),
  ]);
  assert.equal(refunds.enabled,false);assert.equal(payouts.enabled,false);
});

// These tests require a real PostgreSQL instance. They deliberately use
// independent transactions/connection-pool requests rather than JS mocks.
test('concurrent redemption of one MFA recovery code has exactly one winner', async () => {
  const u = await user('recovery-race');
  const credential = await prisma.mfaCredential.create({
    data: { userId: u.id, secretCiphertext: 'encrypted-test-value' },
  });
  const recovery = await prisma.mfaRecoveryCode.create({
    data: { credentialId: credential.id, codeHash: hash('race-e') },
  });
  const results = await Promise.all(Array.from({ length: 8 }, () =>
    prisma.mfaRecoveryCode.updateMany({
      where: { id: recovery.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ));
  assert.equal(results.reduce((sum, value) => sum + value.count, 0), 1);
  assert.ok((await prisma.mfaRecoveryCode.findUniqueOrThrow({ where: { id: recovery.id } })).usedAt);
});

test('concurrent claims of the same session permit at most one rotation winner', async () => {
  const u = await user('session-race');
  const session = await prisma.session.create({
    data: {
      userId: u.id,
      tokenHash: hash('race-f'),
      csrfTokenHash: hash('race-0'),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  const results = await Promise.all(Array.from({ length: 8 }, () =>
    prisma.session.updateMany({
      where: { id: session.id, status: 'ACTIVE', revokedAt: null },
      data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: 'ROTATED' },
    }),
  ));
  assert.equal(results.reduce((sum, value) => sum + value.count, 0), 1);
  assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).status, 'REVOKED');
});
