import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './presentation/auth.controller.js';
import { AuthService } from './application/auth.service.js';
import { PasswordHasher } from './infrastructure/password-hasher.js';
import { SessionService } from './application/session.service.js';
import { GoogleOidcService } from './infrastructure/google-oidc.service.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { RequestSecurityGuard } from './presentation/request-security.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasher,
    SessionService,
    GoogleOidcService,
    PrismaService,
    RequestSecurityGuard,
    { provide: APP_GUARD, useExisting: RequestSecurityGuard },
  ],
})
export class AuthModule {}
