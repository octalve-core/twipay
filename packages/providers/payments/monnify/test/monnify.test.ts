import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MonnifyAdapter } from '../src/index.js';

describe('MonnifyAdapter webhook verification', () => {
  it('accepts a valid HMAC-SHA512 signature', async () => {
    const secretKey = 'test-secret';
    const rawBody = Buffer.from(JSON.stringify({ eventType: 'SUCCESSFUL_TRANSACTION', eventData: { transactionReference: 'm-1', paymentReference: 'twp_fund_test', paymentStatus: 'PAID' } }));
    const signature = createHmac('sha512', secretKey).update(rawBody).digest('hex');
    const adapter = new MonnifyAdapter({ apiKey: 'api-key', secretKey, contractCode: 'contract', baseUrl: 'https://api.monnify.com' });
    const event = await adapter.verifyWebhook({ rawBody, headers: { 'monnify-signature': signature } });
    expect(event.status).toBe('SUCCEEDED');
    expect(event.merchantReference).toBe('twp_fund_test');
  });

  it('never permits unsigned production webhooks', async () => {
    const adapter = new MonnifyAdapter({ apiKey: 'api-key', secretKey: 'secret', contractCode: 'contract', baseUrl: 'https://api.monnify.com', allowUnsignedSandboxWebhooks: true });
    await expect(adapter.verifyWebhook({ rawBody: Buffer.from('{}'), headers: {} })).rejects.toThrow('MONNIFY_WEBHOOK_SIGNATURE_MISSING');
  });
});

it('normalizes a reserved-account credit for server-side settlement verification', async () => {
  const secretKey = 'test-secret';
  const rawBody = Buffer.from(JSON.stringify({
    eventType: 'SUCCESSFUL_TRANSACTION',
    eventData: {
      transactionReference: 'MN-TXN-1',
      paymentReference: 'MN-PAY-1',
      paymentStatus: 'PAID',
      amountPaid: '1500.00',
      currency: 'NGN',
      product: { type: 'RESERVED_ACCOUNT', reference: 'twp_va_reference' },
      destinationAccountInformation: { accountNumber: '0123456789' },
    },
  }));
  const signature = createHmac('sha512', secretKey).update(rawBody).digest('hex');
  const adapter = new MonnifyAdapter({ apiKey: 'api-key', secretKey, contractCode: 'contract', baseUrl: 'https://api.monnify.com' });
  const event = await adapter.verifyWebhook({ rawBody, headers: { 'monnify-signature': signature } });
  expect(event.virtualAccountCredit).toEqual(expect.objectContaining({
    collectionReference: 'MN-PAY-1',
    providerReference: 'MN-TXN-1',
    accountReference: 'twp_va_reference',
    accountNumber: '0123456789',
    amountMinor: 150000n,
    currency: 'NGN',
  }));
  expect(JSON.stringify(event.normalizedPayload)).not.toContain('0123456789');
});
