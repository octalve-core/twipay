import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { SessionAuthGuard } from '../src/modules/auth/presentation/session-auth.guard.js';

const ACTIVE_MFA = { id: 'mfa-verified' };
function setup(input: { emailVerified?: boolean; phoneVerified?: boolean; mfaEnabled?: boolean; mfaSatisfied?: boolean; allowRestricted?: boolean; token?: string } = {}) {
  const user = {
    emailVerifiedAt: input.emailVerified ? new Date() : null,
    phoneE164: input.phoneVerified ? '+2348012345678' : null,
    phoneVerifiedAt: input.phoneVerified ? new Date() : null,
    mfaCredentials: input.mfaEnabled ? [ACTIVE_MFA] : [],
    roleAssignments: [{ role: { code: 'CUSTOMER', permissions: [] } }],
  };
  const sessions = {resolve:vi.fn(async () => ({id:'session-1', userId:'user-1', user, mfaSatisfiedAt:input.mfaSatisfied?new Date():null}))};
  const reflector = {getAllAndOverride:vi.fn(() => input.allowRestricted ?? false)};
  const request = {cookies:{twipay_session:input.token ?? 'opaque'},twipayPrincipal:undefined as unknown};
  const context = {
    switchToHttp:() => ({getRequest:() => request}),
    getHandler:()=>function handler(){},
    getClass:()=>class Controller{},
  } as unknown as ExecutionContext;
  const guard = new SessionAuthGuard(sessions as never, reflector as never);
  return {guard, context, request, sessions, reflector};
}

describe('Batch 3.1 restricted-session HTTP authorization (mocked guard)', () => {
  it('rejects unverified customer at ordinary authenticated endpoints', async()=>{
    const x=setup();
    await expect(x.guard.canActivate(x.context)).rejects.toMatchObject({response:{code:'CONTACT_VERIFICATION_REQUIRED'}});
  });
  it('allows verified email without phone verification', async()=>{
    const x=setup({emailVerified:true});
    await expect(x.guard.canActivate(x.context)).resolves.toBe(true);
    expect((x.request.twipayPrincipal as {userId:string}).userId).toBe('user-1');
  });
  it('allows separately stored and verified phone when contact email is unverified', async()=>{
    const x=setup({phoneVerified:true});
    await expect(x.guard.canActivate(x.context)).resolves.toBe(true);
  });
  it('requires MFA for verified account with enabled MFA and no session assurance', async()=>{
    const x=setup({emailVerified:true,mfaEnabled:true});
    await expect(x.guard.canActivate(x.context)).rejects.toMatchObject({response:{code:'MFA_CHALLENGE_REQUIRED'}});
  });
  it('allows verified account with fresh MFA assurance', async()=>{
    const x=setup({emailVerified:true,mfaEnabled:true,mfaSatisfied:true});
    await expect(x.guard.canActivate(x.context)).resolves.toBe(true);
    expect((x.request.twipayPrincipal as {mfaSatisfied:boolean}).mfaSatisfied).toBe(true);
  });
  it('allows only explicitly annotated recovery/verification actions in restricted sessions', async()=>{
    const x=setup({allowRestricted:true,mfaEnabled:true});
    await expect(x.guard.canActivate(x.context)).resolves.toBe(true);
    expect(x.reflector.getAllAndOverride).toHaveBeenCalledOnce();
  });
});
