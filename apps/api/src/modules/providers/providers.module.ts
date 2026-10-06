import { Module } from '@nestjs/common';
import { PaymentProviderRegistry } from './payment-provider.registry.js';
import { IdentityProviderRegistry } from './identity-provider.registry.js';
import { BillProviderRegistry } from './bill-provider.registry.js';
import { NotificationProviderRegistry } from './notification-provider.registry.js';

@Module({
  providers: [PaymentProviderRegistry, IdentityProviderRegistry, BillProviderRegistry, NotificationProviderRegistry],
  exports: [PaymentProviderRegistry, IdentityProviderRegistry, BillProviderRegistry, NotificationProviderRegistry],
})
export class ProvidersModule {}
