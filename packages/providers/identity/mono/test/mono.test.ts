import { describe, expect, it, vi } from 'vitest';
import { MonoIdentityAdapter } from '../src/index.js';

describe('MonoIdentityAdapter local validation', () => {
  it('rejects malformed BVNs before any billable provider request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const adapter = new MonoIdentityAdapter({ secretKey: 'test-secret' });
    await expect(adapter.initiateIdentityCheck({ reference: 'twp_kyc_test', type: 'BVN', identifier: '123' }))
      .rejects.toThrow('MONO_BVN_FORMAT_INVALID');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
