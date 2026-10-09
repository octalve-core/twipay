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
import { MfaService } from './application/mfa.service.js';
import { MfaController } from './presentation/mfa.controller.js';
import { ContactVerificationService } from './application/contact-verification.service.js';
import { PasswordEnrollmentService } from './application/password-enrollment.service.js';
import { TransactionPinService } from './application/transaction-pin.service.js';
import { PasswordSecurityService } from './application/password-security.service.js';
import { ProvidersModule } from '../providers/providers.module.js';
import { NotificationService } from '../notifications/application/notification.service.js';

@Module({
  imports: [ProvidersModule],
  controllers: [AuthController, MfaController],
  providers: [
    AuthService,
    ContactVerificationService,
    PasswordSecurityService,
    PasswordEnrollmentService,
    TransactionPinService,
    NotificationService,
    MfaService,
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
