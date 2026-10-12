import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from '../src/modules/auth/application/session.service.js';
import { deriveSessionCsrfToken } from '../src/modules/auth/application/session-csrf.js';

const pepper = 'local-only-csrf-test-pepper-long-enough-000000';
const token = 'opaque-current-session';
function hash(v: string) { return createHmac('sha256', pepper).update(v).digest('hex'); }

function fixture(initialCsrfHash = hash('legacy-random-csrf')) {
  const now = new Date();
  const row = {
    id: 'session-1', userId: 'user-1', tokenHash: hash(token), csrfTokenHash: initialCsrfHash,
    status: 'ACTIVE', expiresAt: new Date(now.getTime()+600_000), lastSeenAt: now,
    user: {id:'user-1', status:'ACTIVE', roleAssignments:[]},
  };
  let writes = 0;
  const prisma = {
    session: {
      findUnique: vi.fn(async () => ({...row})),
      updateMany: vi.fn(async ({where,data}: {where: {csrfTokenHash?: string,status?: string}, data:{csrfTokenHash?:string}}) => {
        if (row.status !== 'ACTIVE' || (where.csrfTokenHash && where.csrfTokenHash !== row.csrfTokenHash)) return {count:0};
        if (data.csrfTokenHash) row.csrfTokenHash=data.csrfTokenHash;
        writes++;
        return {count:1};
      }),
    },
  };
  return {row, prisma, writes:()=>writes, service: new SessionService(prisma as never)};
}

describe('concurrent session-bound CSRF',()=>{
  afterEach(()=>{delete process.env['SESSION_HASH_PEPPER'];});
  it('issues the same verified token across simultaneous requests and migrates legacy hash once', async()=>{
    process.env['SESSION_HASH_PEPPER']=pepper;
    const f=fixture();
    const tokens=await Promise.all(Array.from({length:12},()=>f.service.issueCsrf(token)));
    expect(new Set(tokens).size).toBe(1);
    expect(tokens[0]).toBe(deriveSessionCsrfToken(token,pepper));
    expect(f.writes()).toBe(1);
    await Promise.all(tokens.map(csrf=>f.service.verifyCsrf(f.row.id,csrf)));
    expect(f.writes()).toBe(1);
  });
  it('does not mutate the database for already-migrated sessions',async()=>{
    process.env['SESSION_HASH_PEPPER']=pepper;
    const f=fixture(hash(deriveSessionCsrfToken(token,pepper)));
    await Promise.all([f.service.issueCsrf(token),f.service.issueCsrf(token)]);
    expect(f.writes()).toBe(0);
  });
  it('rejects revoked sessions, even if the CSRF token was previously issued',async()=>{
    process.env['SESSION_HASH_PEPPER']=pepper;
    const f=fixture(hash(deriveSessionCsrfToken(token,pepper)));
    const csrf=await f.service.issueCsrf(token);
    f.row.status='REVOKED';
    await expect(f.service.verifyCsrf(f.row.id,csrf)).rejects.toBeTruthy();
    await expect(f.service.issueCsrf(token)).rejects.toBeTruthy();
  });
  it('never accepts another session token or an arbitrary CSRF token',async()=>{
    process.env['SESSION_HASH_PEPPER']=pepper;
    const f=fixture(hash(deriveSessionCsrfToken(token,pepper)));
    await expect(f.service.verifyCsrf(f.row.id,deriveSessionCsrfToken('other-session',pepper))).rejects.toBeTruthy();
  });
});
