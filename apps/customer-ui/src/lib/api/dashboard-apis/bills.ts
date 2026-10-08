import api from '../axios';
import {
  type BillCategory, type BillProduct, type BillPurchase, type BillSubmission, type BillValidation,
  billIdentifier, readBillCatalogue, readBillPurchase, readBillPurchases, readBillSubmission, readBillValidation,
} from './billContracts';

export async function listBillProducts(category: BillCategory): Promise<BillProduct[]> {
  const {data} = await api.get('/services/products', {params:{category}});
  return readBillCatalogue(data, category);
}

/** Validation may call a provider. Keep this disabled until the sandbox is qualified. */
export async function validateBillCustomer(productCode: string, identifier: string): Promise<BillValidation> {
  if (import.meta.env.VITE_TWIPAY_BILLS_SANDBOX_ENABLED !== 'true') throw new Error('Bill validations are not enabled');
  const {data} = await api.post('/services/validations', {productCode, customerIdentifier:billIdentifier(identifier)});
  return readBillValidation(data);
}

export type BillPurchaseIntent = {productCode:string; customerIdentifier:string; amountMinor:string; validationId?:string;contactPhoneE164?:string};
export async function submitBillPurchase(intent: BillPurchaseIntent, idempotencyKey: string): Promise<BillSubmission> {
  if (import.meta.env.VITE_TWIPAY_BILLS_SANDBOX_ENABLED !== 'true') throw new Error('Bill purchases are not enabled');
  if (!/^twipay-bill:[0-9a-f-]{36}$/.test(idempotencyKey)) throw new TypeError('Invalid bill purchase intent');
  const {data} = await api.post('/services/purchases', {...intent,customerIdentifier:billIdentifier(intent.customerIdentifier)},
    {headers:{'Idempotency-Key':idempotencyKey}});
  return readBillSubmission(data,{productCode:intent.productCode,amountMinor:intent.amountMinor});
}
export async function getBillPurchase(reference: string): Promise<BillPurchase> {
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(reference)) throw new TypeError('Invalid bill reference');
  const {data} = await api.get(`/services/purchases/${reference}`);
  return readBillPurchase(data.purchase);
}

export async function listBillPurchases(): Promise<BillPurchase[]> {
  const {data} = await api.get('/services/purchases');
  return readBillPurchases(data);
}
