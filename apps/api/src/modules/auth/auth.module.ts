import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './presentation/auth.controller.js';
import { AuthService } from './application/auth.service.js';
import { PasswordHasher } from './infrastructure/password-hasher.js';
import { SessionService } from './application/session.service.js';
import { GoogleOidcService } from './infrastructure/google-oidc.service.js';
import { RequestSecurityGuard } from './presentation/request-security.guard.js';
import { SessionAuthGuard } from './presentation/session-auth.guard.js';
import { PermissionGuard } from './presentation/permission.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasher,
    SessionService,
    GoogleOidcService,
    SessionAuthGuard,
    PermissionGuard,
    RequestSecurityGuard,
    { provide: APP_GUARD, useExisting: RequestSecurityGuard },
  ],
  exports: [SessionService, SessionAuthGuard, PermissionGuard],
})
export class AuthModule {}
