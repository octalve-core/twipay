import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { IdentityVerificationProviderPort } from '@twipay/contracts';
import { MonoIdentityAdapter } from '@twipay/provider-mono';

@Injectable()
export class IdentityProviderRegistry {
  private mono?: IdentityVerificationProviderPort;

  get(code: 'mono'): IdentityVerificationProviderPort {
    if (code !== 'mono') throw new ServiceUnavailableException({ code: 'IDENTITY_PROVIDER_UNSUPPORTED' });
    if (this.mono) return this.mono;
    const secretKey = process.env.MONO_SECRET_KEY;
    if (!secretKey) throw new ServiceUnavailableException({ code: 'MONO_NOT_CONFIGURED' });
    this.mono = new MonoIdentityAdapter({
      secretKey,
      ...(process.env.MONO_BASE_URL ? { baseUrl: process.env.MONO_BASE_URL } : {}),
    });
    return this.mono;
  }
}
