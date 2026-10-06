import { Module } from '@nestjs/common';
import { PaymentProviderRegistry } from './payment-provider.registry.js';
import { IdentityProviderRegistry } from './identity-provider.registry.js';

@Module({
  providers: [PaymentProviderRegistry, IdentityProviderRegistry],
  exports: [PaymentProviderRegistry, IdentityProviderRegistry],
})
export class ProvidersModule {}
