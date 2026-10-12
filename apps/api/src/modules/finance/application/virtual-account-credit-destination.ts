/** Pure fail-closed provider deposit routing. This is NOT payment verification:
 * PaymentService must first requery the provider, then lock the selected account
 * and recheck its identity before recording a credit. */
export type DepositAccount = {
  id: string;
  userId: string;
  providerCode: string;
  accountReference: string;
  accountNumberFingerprint: string;
  status: string;
  currency: string;
};
export type DepositDestinationDecision =
  | { ok: true; account: DepositAccount }
  | { ok: false; code: 'ACCOUNT_UNMAPPED' | 'ACCOUNT_IDENTIFIERS_CONFLICT' | 'ACCOUNT_NOT_ACTIVE' };

export function resolveDepositDestination(input: {
  providerCode: string;
  accountReference?: string;
  accountNumberFingerprint?: string;
  byReference: DepositAccount | null;
  byNumber: DepositAccount | null;
}): DepositDestinationDecision {
  const hasRef = Boolean(input.accountReference);
  const hasNumber = Boolean(input.accountNumberFingerprint);
  if (!hasRef && !hasNumber) return { ok: false, code: 'ACCOUNT_UNMAPPED' };
  // Never allow a supplied but unrecognized identifier to fall back to another account.
  if ((hasRef && !input.byReference) || (hasNumber && !input.byNumber)) {
    return { ok: false, code: 'ACCOUNT_UNMAPPED' };
  }
  if (hasRef && hasNumber && input.byReference!.id !== input.byNumber!.id) {
    return { ok: false, code: 'ACCOUNT_IDENTIFIERS_CONFLICT' };
  }
  const account = (hasRef ? input.byReference : input.byNumber)!;
  if (account.providerCode !== input.providerCode ||
      (hasRef && account.accountReference !== input.accountReference) ||
      (hasNumber && account.accountNumberFingerprint !== input.accountNumberFingerprint)) {
    return { ok: false, code: 'ACCOUNT_IDENTIFIERS_CONFLICT' };
  }
  if (account.status !== 'ACTIVE' || account.currency !== 'NGN') {
    return { ok: false, code: 'ACCOUNT_NOT_ACTIVE' };
  }
  return { ok: true, account };
}
