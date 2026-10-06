import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { BillProviderPort } from '@twipay/contracts';
import { VtpassAdapter } from '@twipay/provider-vtpass';
import { MonnifyBillsAdapter } from '@twipay/provider-monnify-bills';

export type EnabledBillProvider = 'vtpass' | 'monnify';

@Injectable()
export class BillProviderRegistry {
  private vtpass?: BillProviderPort;
  private monnify?: BillProviderPort;

  get(code: EnabledBillProvider): BillProviderPort {
    if (code === 'vtpass') {
      if (this.vtpass) return this.vtpass;
      const apiKey = process.env['VTPASS_API_KEY'];
      const publicKey = process.env['VTPASS_PUBLIC_KEY'];
      const secretKey = process.env['VTPASS_SECRET_KEY'];
      if (!apiKey || !publicKey || !secretKey) throw new ServiceUnavailableException({ code: 'VTPASS_NOT_CONFIGURED' });
      this.vtpass = new VtpassAdapter({
        apiKey,
        publicKey,
        secretKey,
        ...(process.env['VTPASS_BASE_URL'] ? { baseUrl: process.env['VTPASS_BASE_URL'] } : {}),
      });
      return this.vtpass;
    }

    if (this.monnify) return this.monnify;
    const apiKey = process.env['MONNIFY_API_KEY'];
    const secretKey = process.env['MONNIFY_SECRET_KEY'];
    if (!apiKey || !secretKey) throw new ServiceUnavailableException({ code: 'MONNIFY_BILLS_NOT_CONFIGURED' });
    const defaultBaseUrl = process.env['NODE_ENV'] === 'production' ? 'https://api.monnify.com' : 'https://sandbox.monnify.com';
    this.monnify = new MonnifyBillsAdapter({
      apiKey,
      secretKey,
      baseUrl: process.env['MONNIFY_BASE_URL'] ?? defaultBaseUrl,
    });
    return this.monnify;
  }
}
