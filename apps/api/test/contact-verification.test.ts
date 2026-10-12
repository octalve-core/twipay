import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactVerificationService } from '../src/modules/auth/application/contact-verification.service.js';
import { contactVerified } from '../src/modules/auth/application/contact-permissions.js';

const PEPPER = 'batch-31-test-pepper-at-least-thirty-two-characters';
const USER = '22222222-2222-4222-8222-222222222222';
type Challenge = {id:string;userId:string;email:string;codeHash:string;createdAt:Date;expiresAt:Date;consumedAt:Date|null;failedAttempts:number};

/** Simulates the user-row transaction lock; NOT a replacement for PostgreSQL integration. */
function fixture() {
  let lock = Promise.resolve();
  const user = { id: USER, status: 'ACTIVE', email: 'test@twipay.example', emailVerifiedAt: null as Date | null };
  const challenges: Challenge[] = [];
  const events: unknown[] = [];
  const outbox: Array<{id:string;text:string;destination:string}> = [];
  let serial = 0;
  const tx = {
    $queryRaw: vi.fn(async () => [{id:USER}]),
    user: {
      findUniqueOrThrow: vi.fn(async () => ({...user})),
      update: vi.fn(async (args: {data: {emailVerifiedAt: Date}}) => { user.emailVerifiedAt=args.data.emailVerifiedAt;return user; }),
    },
    contactVerificationChallenge: {
      create: vi.fn(async (args: {data: {userId:string;email:string;codeHash:string;expiresAt:Date}}) => {
        const row:Challenge = {id:`challenge-${++serial}`, ...args.data, consumedAt:null,failedAttempts:0,createdAt:new Date()};
        challenges.push(row); return row;
      }),
      findFirst: vi.fn(async () => challenges.at(-1) ?? null),
      count: vi.fn(async (args: {where:{createdAt:{gte:Date}}}) => challenges.filter(r=>r.createdAt>=args.where.createdAt.gte).length),
      update: vi.fn(async (args: {where:{id:string};data:{failedAttempts?:{increment:number};consumedAt?:Date}}) => {
        const row=challenges.find(c=>c.id===args.where.id)!;
        if(args.data.failedAttempts)row.failedAttempts+=args.data.failedAttempts.increment;
        if(args.data.consumedAt)row.consumedAt=args.data.consumedAt;
        return row;
      }),
      updateMany: vi.fn(async (args: {where:{userId:string;consumedAt:null};data:{consumedAt:Date}}) => {
        const rows=challenges.filter(c=>c.userId===args.where.userId&&!c.consumedAt);
        rows.forEach(r=>r.consumedAt=args.data.consumedAt);
        return {count:rows.length};
      }),
    },
    securityEvent: {create:vi.fn(async (args: {data:unknown}) => {events.push(args.data);return args.data;})},
  };
  const prisma = {
    $transaction: vi.fn(async <T>(callback:(client:typeof tx)=>Promise<T>) => {
      const predecessor=lock;
      let release!:()=>void;
      lock=new Promise<void>(resolve=>{release=resolve;});
      await predecessor;
      try{return await callback(tx);}finally{release();}
    }),
    notification: {findUnique:vi.fn(async () => ({status:'PENDING'}))},
  };
  const notifications = {
    enqueueWithTx: vi.fn(async (_tx: unknown, args: {text:string;destination:string}) => {
      const n={id:`message-${++serial}`, text:args.text,destination:args.destination};outbox.push(n);return n;
    }),
    deliver:vi.fn(async () => undefined),
  };
  const service = new ContactVerificationService(prisma as never, notifications as never);
  const issue = async () => {await service.issueInitialWithTx(tx as never,user.id,user.email);return currentCode();};
  const currentCode = () => outbox.at(-1)!.text.match(/code is (\d{6})/i)![1]!;
  return {user,challenges,events,outbox,notifications,tx,prisma,service,issue,currentCode};
}

describe('Batch 3.1 email-challenge service logic (mocked transactional unit tests)',()=>{
  beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-09T07:00:00Z'));process.env['SESSION_HASH_PEPPER']=PEPPER;});
  afterEach(()=>{vi.useRealTimers();delete process.env['SESSION_HASH_PEPPER'];});

  it('persistently binds an unexposed digest to current account email and encrypted-outbox boundary',async()=>{
    const f=fixture();const code=await f.issue();
    expect(f.challenges[0]!.codeHash).not.toBe(code);
    expect(f.challenges[0]!.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(f.challenges[0]!.email).toBe(f.user.email);
    expect(f.outbox).toHaveLength(1);
    expect(f.user.emailVerifiedAt).toBeNull();
  });
  it('consumes exactly once and denies a successful code replay',async()=>{
    const f=fixture();const code=await f.issue();
    await expect(f.service.confirm(USER,code)).resolves.toBeUndefined();
    expect(f.user.emailVerifiedAt).toBeInstanceOf(Date);
    await expect(f.service.confirm(USER,code)).rejects.toMatchObject({response:{code:'CONTACT_ALREADY_VERIFIED'}});
    expect(f.challenges[0]!.consumedAt).toBeInstanceOf(Date);
  });
  it('commits failed-attempt accounting and locks challenge after five guesses',async()=>{
    const f=fixture();const code=await f.issue();
    for(let i=0;i<5;i++) await expect(f.service.confirm(USER,code==='000000'?'111111':'000000')).rejects.toMatchObject({response:{code:'CONTACT_CODE_INVALID'}});
    expect(f.challenges[0]!.failedAttempts).toBe(5);
    await expect(f.service.confirm(USER,code)).rejects.toMatchObject({response:{code:'CONTACT_CODE_INVALID'}});
    expect(f.user.emailVerifiedAt).toBeNull();
  });
  it('rejects expired codes without touching verification state',async()=>{
    const f=fixture();const code=await f.issue();
    vi.setSystemTime(new Date(Date.now()+10*60_000+1));
    await expect(f.service.confirm(USER,code)).rejects.toMatchObject({response:{code:'CONTACT_CODE_INVALID'}});
    expect(f.user.emailVerifiedAt).toBeNull();
  });
  it('rejects codes bound to the old email after an account email change',async()=>{
    const f=fixture();const code=await f.issue();f.user.email='changed@twipay.example';
    await expect(f.service.confirm(USER,code)).rejects.toMatchObject({response:{code:'CONTACT_CODE_INVALID'}});
  });
  it('enforces cooldown and invalidates previous challenge after a permitted resend',async()=>{
    const f=fixture();const first=await f.issue();
    await expect(f.service.resend(USER)).rejects.toMatchObject({response:{code:'CONTACT_RESEND_TOO_SOON'}});
    vi.setSystemTime(new Date(Date.now()+60_001));
    await expect(f.service.resend(USER)).resolves.toBe('PENDING');
    expect(f.challenges[0]!.consumedAt).toBeInstanceOf(Date);
    await expect(f.service.confirm(USER,first)).rejects.toMatchObject({response:{code:'CONTACT_CODE_INVALID'}});
    await expect(f.service.confirm(USER,f.currentCode())).resolves.toBeUndefined();
  });
  it('limits each account to ten issued challenges per rolling 24 hours',async()=>{
    const f=fixture();await f.issue();
    for(let i=0;i<9;i++) {vi.setSystemTime(new Date(Date.now()+60_001));await f.service.resend(USER);}
    vi.setSystemTime(new Date(Date.now()+60_001));
    await expect(f.service.resend(USER)).rejects.toMatchObject({response:{code:'CONTACT_RESEND_LIMIT'}});
    expect(f.challenges).toHaveLength(10);
  });
  it('two concurrent confirmations produce precisely one completed verification',async()=>{
    const f=fixture();const code=await f.issue();
    const outcomes=await Promise.allSettled([f.service.confirm(USER,code),f.service.confirm(USER,code)]);
    expect(outcomes.filter(o=>o.status==='fulfilled')).toHaveLength(1);
    expect(outcomes.filter(o=>o.status==='rejected')).toHaveLength(1);
    expect(f.user.emailVerifiedAt).toBeInstanceOf(Date);
  });
  it('two concurrent resends cannot issue two new challenges in one cooldown',async()=>{
    const f=fixture();await f.issue();vi.setSystemTime(new Date(Date.now()+60_001));
    const outcomes=await Promise.allSettled([f.service.resend(USER),f.service.resend(USER)]);
    expect(outcomes.filter(o=>o.status==='fulfilled')).toHaveLength(1);
    expect(outcomes.filter(o=>o.status==='rejected')).toHaveLength(1);
    expect(f.challenges).toHaveLength(2);
  });
  it('does not report provider acceptance when dispatch fails',async()=>{
    const f=fixture();await f.issue();
    f.notifications.deliver.mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(f.service.dispatch(f.outbox[0]!.id)).resolves.toBe('PENDING');
  });
  it('requires a stored phone before phone verification timestamp confers access',()=>{
    expect(contactVerified({emailVerifiedAt:null,phoneE164:null,phoneVerifiedAt:new Date()})).toBe(false);
    expect(contactVerified({emailVerifiedAt:null,phoneE164:'+2348012345678',phoneVerifiedAt:new Date()})).toBe(true);
  });
});
