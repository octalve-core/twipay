import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PaystackAdapter } from '../src/index.js';

describe('PaystackAdapter webhook verification', () => {
  it('accepts a valid HMAC-SHA512 signature and normalizes success', async () => {
    const secretKey = 'test-secret';
    const rawBody = Buffer.from(JSON.stringify({ event: 'charge.success', data: { id: 7, reference: 'twp_fund_test', status: 'success' } }));
    const signature = createHmac('sha512', secretKey).update(rawBody).digest('hex');
    const event = await new PaystackAdapter({ secretKey }).verifyWebhook({ rawBody, headers: { 'x-paystack-signature': signature } });
    expect(event.status).toBe('SUCCEEDED');
    expect(event.merchantReference).toBe('twp_fund_test');
  });

  it('rejects an invalid signature', async () => {
    const rawBody = Buffer.from('{}');
    await expect(new PaystackAdapter({ secretKey: 'test-secret' }).verifyWebhook({ rawBody, headers: { 'x-paystack-signature': '00'.repeat(64) } }))
      .rejects.toThrow('PAYSTACK_WEBHOOK_SIGNATURE_INVALID');
  });
});

it('normalizes dedicated-account assignment without exposing raw payload', async () => {
  const secretKey = 'test-secret';
  const rawBody = Buffer.from(JSON.stringify({
    event: 'dedicatedaccount.assign.success',
    data: {
      customer: { email: 'person@example.com' },
      dedicated_account: {
        id: 42,
        account_number: '0123456789',
        account_name: 'TWIPAY USER',
        currency: 'NGN',
        bank: { name: 'Example Bank' },
      },
    },
  }));
  const signature = createHmac('sha512', secretKey).update(rawBody).digest('hex');
  const event = await new PaystackAdapter({ secretKey }).verifyWebhook({ rawBody, headers: { 'x-paystack-signature': signature } });
  expect(event.virtualAccountAssignment).toEqual(expect.objectContaining({
    status: 'ACTIVE',
    customerEmail: 'person@example.com',
    providerAccountId: '42',
    accountNumber: '0123456789',
  }));
  expect(JSON.stringify(event.normalizedPayload)).not.toContain('0123456789');
});

it('recognizes a dedicated-NUBAN credit as a virtual-account collection event', async () => {
  const secretKey = 'test-secret';
  const rawBody = Buffer.from(JSON.stringify({
    event: 'charge.success',
    data: {
      id: 91,
      reference: 'ps_dva_credit_1',
      status: 'success',
      amount: 250000,
      currency: 'NGN',
      authorization: { channel: 'dedicated_nuban', receiver_bank_account_number: '0123456789' },
    },
  }));
  const signature = createHmac('sha512', secretKey).update(rawBody).digest('hex');
  const event = await new PaystackAdapter({ secretKey }).verifyWebhook({ rawBody, headers: { 'x-paystack-signature': signature } });
  expect(event.virtualAccountCredit).toEqual(expect.objectContaining({
    collectionReference: 'ps_dva_credit_1',
    providerReference: '91',
    accountNumber: '0123456789',
    amountMinor: 250000n,
    currency: 'NGN',
  }));
});
