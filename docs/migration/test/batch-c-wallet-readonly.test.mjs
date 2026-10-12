import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {formatNgnMinorUnits} from '../../../apps/customer-ui/src/lib/money.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

test('minor-unit formatter preserves integer cents exactly, even outside Number.MAX_SAFE_INTEGER', () => {
  assert.equal(formatNgnMinorUnits('0'), '₦0.00');
  assert.equal(formatNgnMinorUnits('1'), '₦0.01');
  assert.equal(formatNgnMinorUnits('99'), '₦0.99');
  assert.equal(formatNgnMinorUnits('100'), '₦1.00');
  assert.equal(formatNgnMinorUnits('123456789'), '₦1,234,567.89');
  assert.equal(formatNgnMinorUnits('9007199254740991'), '₦90,071,992,547,409.91');
  assert.equal(formatNgnMinorUnits('-1'), '-₦0.01');
  for (const bad of ['1.5', '0.00', 'NaN', '1e3', '1,000', ' 1', '', '01']) {
    assert.throws(() => formatNgnMinorUnits(bad), TypeError, bad);
  }
});

test('wallet read contract is directly evidenced by FinanceController', () => {
  const api = read('apps/api/src/modules/finance/presentation/finance.controller.ts');
  const client = read('apps/customer-ui/src/lib/api/dashboard-apis/walletApis.ts');
  assert.match(api, /@Get\('wallets'\)/);
  for (const field of ['postedBalanceMinor', 'activeHoldsMinor', 'availableBalanceMinor']) {
    assert.match(api, new RegExp(`${field}: summary\\.${field}\\.toString\\(\\)`));
    assert.match(client, new RegExp(field));
  }
  assert.match(client, /api\.get<\{wallet: Wallet\}>\("\/wallets"\)/);
  assert.match(client, /currency !== "NGN"/);
  assert.doesNotMatch(client.split('export const fetchProviders')[0], /Number\(|parseFloat\(|\.balance\b|\/wallet"/);
});

test('ErhaPay balance card remains visually original with server-derived kobo string', () => {
  const card = read('apps/customer-ui/src/components/dashboard/main-page/BalanceCard.tsx');
  assert.match(card, /w-full bg-black h-\[110px\] md:h-\[152px\]/);
  assert.match(card, /getWallet/);
  assert.match(card, /formatNgnMinorUnits\(wallet\.availableBalanceMinor\)/);
  assert.match(card, /Balance temporarily unavailable/);
  assert.match(card, /aria-label=\{hideBalance/);
  assert.doesNotMatch(card, /formatAmount\(|wallet\.balance\b|queryKey: \["countries"\]/);
});

test('all existing wallet-reading surfaces use same scoped query key and exact formatter', () => {
  const base = 'apps/customer-ui/src/components/dashboard/';
  for (const path of [
    'main-page/BalanceCard.tsx',
    'transfer-funds/TransferFundsForm.tsx', 'withdraw-funds/EnterAmount.tsx',
    'services/airtime/RecipientDetails.tsx',
    'services/international-data/RecipientDetails.tsx',
    'services/international-airtime/RecipientDetails.tsx',
    'services/mobile-money/RecipientDetails.tsx',
  ]) {
    const code = read(base+path);
    assert.match(code, /queryKey: \["wallet", "twipay-v1"\]/, path);
    assert.match(code, /formatNgnMinorUnits\(wallet\.availableBalanceMinor\)/, path === 'main-page/BalanceCard.tsx' ? undefined : path);
    assert.doesNotMatch(code, /wallet\?\.balance\s+as\s+number|wallet\.balance\b/, path);
  }
});

test('financial writes remain closed to legacy routes and require future verified contracts', () => {
  const gate = read('apps/customer-ui/src/lib/api/axios.ts');
  assert.match(gate, /"\/wallets"/);
  assert.match(gate, /FEATURE_NOT_INTEGRATED/);
  assert.doesNotMatch(gate.split('const publicAuth')[1].split(';')[0], /"\/wallet\/fund"|"\/wallet\/transfer"|"\/wallet\/bank-transfer"/);
  assert.match(gate, /x-csrf-token/);
});
