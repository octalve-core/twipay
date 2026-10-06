import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { PaymentProviderPort } from '@twipay/contracts';
import { PaystackAdapter } from '@twipay/provider-paystack';
import { MonnifyAdapter } from '@twipay/provider-monnify';

export type EnabledPaymentProvider = 'paystack' | 'monnify';

@Injectable()
export class PaymentProviderRegistry {
  private paystack?: PaymentProviderPort;
  private monnify?: PaymentProviderPort;

  get(code: EnabledPaymentProvider): PaymentProviderPort {
    if (code === 'paystack') {
      if (this.paystack) return this.paystack;
      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) throw new ServiceUnavailableException({ code: 'PAYSTACK_NOT_CONFIGURED' });
      this.paystack = new PaystackAdapter({
        secretKey,
        ...(process.env.PAYSTACK_BASE_URL ? { baseUrl: process.env.PAYSTACK_BASE_URL } : {}),
      });
      return this.paystack;
    }

    if (this.monnify) return this.monnify;
    const apiKey = process.env.MONNIFY_API_KEY;
    const secretKey = process.env.MONNIFY_SECRET_KEY;
    const contractCode = process.env.MONNIFY_CONTRACT_CODE;
    if (!apiKey || !secretKey || !contractCode) {
      throw new ServiceUnavailableException({ code: 'MONNIFY_NOT_CONFIGURED' });
    }
    const defaultBaseUrl = process.env.NODE_ENV === 'production'
      ? 'https://api.monnify.com'
      : 'https://sandbox.monnify.com';
    this.monnify = new MonnifyAdapter({
      apiKey,
      secretKey,
      contractCode,
      ...(process.env.MONNIFY_SOURCE_ACCOUNT_NUMBER ? { sourceAccountNumber: process.env.MONNIFY_SOURCE_ACCOUNT_NUMBER } : {}),
      baseUrl: process.env.MONNIFY_BASE_URL ?? defaultBaseUrl,
      allowUnsignedSandboxWebhooks: process.env.MONNIFY_ALLOW_UNSIGNED_SANDBOX_WEBHOOKS === 'true',
    });
    return this.monnify;
  }
}
