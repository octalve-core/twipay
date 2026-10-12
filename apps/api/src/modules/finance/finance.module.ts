import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProvidersModule } from '../providers/providers.module.js';
import { FinanceController } from './presentation/finance.controller.js';
import { IdempotencyService } from './application/idempotency.service.js';
import { FinancialTransactionService } from './application/financial-transaction.service.js';
import { LedgerService } from './application/ledger.service.js';
import { WalletService } from './application/wallet.service.js';
import { PaymentService } from './application/payment.service.js';
import { TransferService } from './application/transfer.service.js';
import { VirtualAccountService } from './application/virtual-account.service.js';
import { ReconciliationService } from './application/reconciliation.service.js';
import { FinancialAuthorizationService } from './application/financial-authorization.service.js';

@Module({
  imports: [AuthModule, ProvidersModule],
  controllers: [FinanceController],
  providers: [
    IdempotencyService,
    FinancialTransactionService,
    LedgerService,
    WalletService,
    PaymentService,
    TransferService,
    VirtualAccountService,
    ReconciliationService,
    FinancialAuthorizationService,
  ],
  exports: [
    IdempotencyService,
    FinancialTransactionService,
    LedgerService,
    WalletService,
    PaymentService,
    TransferService,
    VirtualAccountService,
    ReconciliationService,
    FinancialAuthorizationService,
  ],
})
export class FinanceModule {}
