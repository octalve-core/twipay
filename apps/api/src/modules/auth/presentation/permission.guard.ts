import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedFastifyRequest } from './session-auth.guard.js';
import { requirePrincipal } from './session-auth.guard.js';

export const REQUIRED_PERMISSIONS = 'twipay:required-permissions';
export const RequirePermissions = (...permissions: string[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<readonly string[]>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()]) ?? [];
    if (required.length === 0) return true;
    const req = context.switchToHttp().getRequest<AuthenticatedFastifyRequest>();
    const principal = requirePrincipal(req);
    if (principal.roles.includes('SUPER_ADMIN')) return true;
    if (!required.every((permission) => principal.permissions.includes(permission))) {
      throw new ForbiddenException({ code: 'PERMISSION_REQUIRED', required });
    }
    return true;
  }
}

export function requireMfa(req: AuthenticatedFastifyRequest): void {
  const principal = requirePrincipal(req);
  if (!principal.mfaSatisfied) throw new ForbiddenException({ code: 'MFA_STEP_UP_REQUIRED' });
}
