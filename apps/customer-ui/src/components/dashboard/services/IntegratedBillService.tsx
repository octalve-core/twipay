import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import BackButton from '@/components/Authentication/BackButton';
import CustomButton from '@/components/CustomButton';
import { formatNgnMinorUnits } from '@/lib/money';
import { billIdentifier, billIsFinal, billIsSuccess, billNairaToMinor, readBillPurchase, type BillCategory, type BillSubmission, type BillProduct, type BillValidation, type BillQuote } from '@/lib/api/dashboard-apis/billContracts';
import { getBillPurchase, listBillProducts, listBillPurchases, submitBillPurchase, validateBillCustomer, requestBillQuote } from '@/lib/api/dashboard-apis/bills';
import { brand } from "@/config/brand";

type Stage = 'details'|'review'|'result';
const titles: Record<BillCategory,string> = {AIRTIME:'Buy Airtime',DATA:'Buy Data',ELECTRICITY:'Pay Electricity',CABLE:'Buy TV/Cable'};
const labels: Record<BillCategory,string> = {AIRTIME:'Recipient phone number',DATA:'Recipient phone number',ELECTRICITY:'Meter number',CABLE:'Smartcard number'};
const inputs = 'w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] text-[#344054]';
const intentStorageKey = 'twipay:bill-purchase-intent:v1';
type StoredIntent = { idempotencyKey:string; reference?:string };
function readStoredIntent(): StoredIntent | null {
  try {
    const raw = sessionStorage.getItem(intentStorageKey);
    const value = raw ? JSON.parse(raw) as StoredIntent : null;
    return value && /^twipay-bill:[0-9a-f-]{36}$/.test(value.idempotencyKey) &&
      (value.reference === undefined || /^[A-Za-z0-9._:-]{1,80}$/.test(value.reference)) ? value : null;
  } catch { return null; }
}
function writeStoredIntent(intent: StoredIntent): void { sessionStorage.setItem(intentStorageKey, JSON.stringify(intent)); }
function displayError(error: unknown): string {
  if (error instanceof Error && /(?:not enabled|minimum|maximum|fixed price|valid customer|valid amount|contact phone|customer identifier|response)/i.test(error.message)) return error.message;
  return 'Unable to complete this request. Review your purchase history before retrying; a payment may still be processing.';
}
/** ErhaPay look and navigation shell, TwiPay-authenticated provider-neutral bill contracts. */
export default function IntegratedBillService({category}: {category:BillCategory}) {
  const [productCode,setProductCode] = useState('');
  const [identifier,setIdentifier] = useState('');
  const [amount,setAmount] = useState('');
  const [contactPhone,setContactPhone] = useState('');
  const [pin,setPin] = useState('');
  const [stage,setStage] = useState<Stage>('details');
  const [result,setResult] = useState<BillSubmission|null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [previous,setPrevious] = useState<StoredIntent|null>(()=>readStoredIntent());
  const [checking,setChecking] = useState(false);
  const [showRecent,setShowRecent] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef<{key:string; signature:string}|null>(null);
  const sandbox = import.meta.env.VITE_TWIPAY_BILLS_SANDBOX_ENABLED === 'true';
  const products = useQuery({queryKey:['twipay','bill-products',category],queryFn:()=>listBillProducts(category),retry:false});
  const previousPurchases = useQuery({queryKey:['twipay','bill-purchases'],queryFn:listBillPurchases,enabled:showRecent,retry:false});
  const chosen = useMemo(()=>products.data?.find(p=>p.code===productCode),[products.data,productCode]);
  const fixed = chosen?.fixedAmountMinor !== null && chosen?.fixedAmountMinor !== undefined;
  const amountToUse = fixed && chosen ? `${BigInt(chosen.fixedAmountMinor!) / 100n}.${(BigInt(chosen.fixedAmountMinor!) % 100n).toString().padStart(2,'0')}` : amount;
  const [review,setReview] = useState<{product:BillProduct;identifier:string;amountMinor:string;validation:BillValidation;quote:BillQuote;contactPhoneE164?:string}|null>(null);

  const clearPrevious = () => {
    if (!window.confirm('Only start a NEW purchase after reviewing any previous payment in transaction history. A pending payment can still complete. Continue?')) return;
    sessionStorage.removeItem(intentStorageKey);
    setPrevious(null); attempt.current=null; setResult(null);setReview(null);setStage('details');setPin('');setError('');
  };
  async function onReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (inFlight.current || !chosen || previous) return;
    setError('');
    try {
      const clean = billIdentifier(identifier);
      const amountMinor=billNairaToMinor(amountToUse,chosen);
      if (contactPhone && !/^\+[1-9]\d{7,14}$/.test(contactPhone.trim())) throw new Error('Enter a valid contact phone number in international format');
      if (!sandbox) throw new Error('Bill purchases are not enabled');
      inFlight.current=true;setBusy(true);
      const verified = await validateBillCustomer(chosen.code,clean);
      if (!verified.valid || Date.parse(verified.expiresAt) <= Date.now()) throw new Error('Customer validation was rejected or expired');
      const quote = await requestBillQuote({productCode:chosen.code,customerIdentifier:clean,amountMinor,validationId:verified.id});
      setPin('');setReview({product:chosen,identifier:clean,amountMinor,validation:verified,quote,...(contactPhone.trim() ? {contactPhoneE164:contactPhone.trim()} : {})});
      setStage('review');
    } catch (err) {setError(displayError(err));}
    finally {inFlight.current=false;setBusy(false);}
  }
  async function onPurchase() {
    if (!review || inFlight.current || result || (previous && previous.idempotencyKey !== attempt.current?.key) || !sandbox) return;
    setError('');
    if (Date.parse(review.validation.expiresAt) <= Date.now() || Date.parse(review.quote.expiresAt) <= Date.now()) {setStage('details');setReview(null);setPin('');setError('Your purchase confirmation expired. Please verify again.');return;}
    if (!/^\d{4}$/.test(pin)) {setError('Enter your four-digit transaction PIN to confirm this purchase.');return;}
    const signature=`${review.product.code}|${review.identifier}|${review.amountMinor}|${review.quote.quoteId}|${review.contactPhoneE164??''}`;
    try {
      inFlight.current=true;setBusy(true);
      if (attempt.current && attempt.current.signature !== signature) throw new Error('This is a different purchase. Check your history before continuing.');
      if (!attempt.current) attempt.current={key:`twipay-bill:${crypto.randomUUID()}`,signature};
      const stored={idempotencyKey:attempt.current.key};
      // Fail closed if retry protection cannot be persisted through navigation/reload.
      writeStoredIntent(stored);setPrevious(stored);
      const purchase=await submitBillPurchase({productCode:review.product.code, customerIdentifier:review.identifier, amountMinor:review.amountMinor, validationId:review.validation.id,quoteToken:review.quote.quoteToken,transactionPin:pin,...(review.contactPhoneE164 ? {contactPhoneE164:review.contactPhoneE164} : {})},attempt.current.key);
      const next={...stored,reference:purchase.reference};
      writeStoredIntent(next);setPrevious(next);setResult(purchase);setStage('result');
    } catch (err) {
      // An HTTP 409 may be the backend's recorded FAILED purchase result. Parse it strictly;
      // never treat generic 409/idempotency conflict or a lost connection as confirmed failure.
      if (isAxiosError(err) && err.response?.status === 409 && review) {
        try {
          const failed = readBillPurchase(err.response.data, {productCode:review.product.code,amountMinor:review.amountMinor});
          if (failed.status === 'FAILED') {
            const updated = {idempotencyKey:attempt.current!.key,reference:failed.reference};
            writeStoredIntent(updated);setPrevious(updated);setResult(failed);setStage('result');
            return;
          }
        } catch { /* Unknown 409 must not be translated into provider failure. */ }
      }
      // A network error is not proof of failure. Retain the same key and block a fresh debit.
      setError(displayError(err));
    } finally {setPin('');inFlight.current=false;setBusy(false);}
  }
  async function checkPurchaseStatus(reference:string) {
    if (inFlight.current || checking) return;
    setError('');inFlight.current=true;setChecking(true);
    try {
      const purchase=await getBillPurchase(reference);
      setResult(purchase);setStage('result');
    } catch(err) {setError(displayError(err));}
    finally {inFlight.current=false;setChecking(false);}
  }

  return <section className="w-full max-w-[410px] mx-auto px-2 md:px-0 text-[#112929]">
    <BackButton className="mb-8 mt-2" href="/dashboard/services" />
    <h1 className="font-medium text-2xl text-[#112929]">{titles[category]}</h1>
    <p className="text-[#717171] mt-2 mb-7">{stage==='details'?'Select a service and enter recipient details':stage==='review'?'Review your purchase details':'Purchase status'}</p>
    {!sandbox && <p role="status" className="rounded-lg bg-[#FFF8E6] border border-[#E8D5A0] text-[#714F00] p-3 text-sm mb-5">Bill payments are temporarily unavailable. You can browse services, but purchases are currently paused.</p>}
    {previous && !result && <div role="status" className="rounded-lg border border-[#D0D5DD] p-3 mb-5 text-sm text-[#475467]">
      A previous purchase attempt may still be processing. Do not initiate another payment until you review its status.
      {!previous.reference && review && attempt.current?.key === previous.idempotencyKey && <button className="block mt-2 underline text-[#112929]" disabled={busy} onClick={()=>void onPurchase()}>Retry this purchase safely</button>}
      {previous.reference && <button className="block mt-2 underline text-[#112929]" disabled={checking} onClick={()=>void checkPurchaseStatus(previous.reference!)}>Check previous purchase status</button>}
      <button className="block mt-2 underline text-[#112929]" onClick={clearPrevious}>Start a new purchase after reviewing history</button>
    </div>}
    {error && <p role="alert" className="text-red-700 text-sm mb-4">{error}</p>}
    {stage==='details' && <form className="flex flex-col gap-5" onSubmit={e=>void onReview(e)}>
      <label className="text-sm font-medium text-[#344054]">Product / service
        <select className={inputs} value={productCode} disabled={products.isLoading || busy} onChange={e=>{setProductCode(e.target.value);setReview(null);setAmount('');}}>
          <option value="">{products.isLoading?'Loading services…':'Select a product'}</option>
          {products.data?.map(p=><option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
      </label>
      {products.isError && <p role="alert" className="text-red-700 text-sm">Service products cannot be loaded. Please try again later.</p>}
      {products.data?.length===0 && <p role="status" className="text-sm text-[#717171]">No products are available for this service right now.</p>}
      <label className="text-sm font-medium text-[#344054]">{chosen?.customerIdentifierType?.replace(/_/g,' ') || labels[category]}
        <input className={inputs} type="text" maxLength={64} autoComplete="off" value={identifier} onChange={e=>{setIdentifier(e.target.value);setReview(null);}} placeholder={labels[category]} required />
      </label>
      <label className="text-sm font-medium text-[#344054]">Contact phone (optional; +234…)
        <input className={inputs} type="tel" maxLength={16} autoComplete="tel" value={contactPhone} onChange={e=>{setContactPhone(e.target.value);setReview(null);}} placeholder="+2348012345678" />
      </label>
      <label className="text-sm font-medium text-[#344054]">Amount (NGN)
        <input className={inputs} type="text" inputMode="decimal" value={amountToUse} onChange={e=>setAmount(e.target.value)} disabled={fixed || busy} required={!fixed} placeholder={fixed?'Fixed product amount':'0.00'} />
        {chosen && <span className="text-xs text-[#717171] mt-1 block">{chosen.fixedAmountMinor !== null ? 'Provider fixed price: '+formatNgnMinorUnits(chosen.fixedAmountMinor) : `Provider limits: ${chosen.minAmountMinor ? formatNgnMinorUnits(chosen.minAmountMinor) : 'Not specified'} – ${chosen.maxAmountMinor ? formatNgnMinorUnits(chosen.maxAmountMinor) : 'Not specified'}`}</span>}
      </label>
      <CustomButton disabled={!sandbox || !chosen || busy || Boolean(previous) || products.isError} isLoading={busy}>Proceed — Verify details</CustomButton>
    </form>}
    {stage==='review' && review && <div className="flex flex-col gap-4">
      <div className="border border-[#D0D5DD] rounded-lg p-4 text-[#344054] text-sm space-y-3">
        <p><strong>Service:</strong> {review.product.name}</p>
        <p><strong>Recipient:</strong> {review.identifier}</p>
        {review.validation.customerName && <p><strong>Verified account name:</strong> {review.validation.customerName}</p>}
        <p><strong>Service amount:</strong> {formatNgnMinorUnits(review.quote.amountMinor)}</p>
        <p><strong>Approved customer fee:</strong> {formatNgnMinorUnits(review.quote.feeMinor)}</p>
        <p className="font-medium"><strong>Total wallet debit:</strong> {formatNgnMinorUnits(review.quote.totalDebitMinor)}</p>
        <p><strong>Provider:</strong> {review.quote.provider}</p>
        <p className="text-[#717171]">Confirmation expires at {new Date(review.quote.expiresAt).toLocaleTimeString()}.</p>
        {review.contactPhoneE164 && <p><strong>Contact:</strong> {review.contactPhoneE164}</p>}
        <p className="text-[#717171]">The provider and final receipt status are verified by {brand.name}. No success is assumed from clicking Confirm.</p>
      </div>
      <label htmlFor="bill-purchase-pin" className="text-sm font-medium text-[#344054]">Transaction PIN
        <input id="bill-purchase-pin" className={inputs} type="password" inputMode="numeric" autoComplete="off" maxLength={4}
          value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,'').slice(0,4))}
          placeholder="Enter 4-digit PIN" disabled={busy} required />
      </label>
      <CustomButton type="button" disabled={!sandbox || busy || Boolean(previous) || !/^\d{4}$/.test(pin)} isLoading={busy} onClick={()=>void onPurchase()}>Confirm purchase</CustomButton>
      <CustomButton type="button" variant="primary" disabled={busy} onClick={()=>{setStage('details');setReview(null);setPin('');}}>Back to details</CustomButton>
    </div>}
    {stage==='result' && result && <div className="flex flex-col gap-4 text-sm text-[#344054]">
      <div className="border border-[#D0D5DD] rounded-lg p-4 space-y-3">
        <p><strong>Reference:</strong> <span className="break-all">{result.reference}</span></p>
        <p><strong>Product:</strong> {("productName" in result ? result.productName : "Purchase awaiting reconciliation")}</p>
        <p><strong>Amount:</strong> {("amountMinor" in result ? formatNgnMinorUnits(result.amountMinor) : (review ? formatNgnMinorUnits(review.amountMinor) : "Not available"))}</p>
        <p role="status" className="font-medium">Status: {result.status}</p>
        {billIsSuccess(result.status) && ("fulfillment" in result && result.fulfillment) && <p className="break-words"><strong>Provider fulfillment:</strong> {("fulfillment" in result && result.fulfillment)}</p>}
        {!billIsFinal(result.status) && <p className="text-[#717171]">This purchase has not been confirmed successful. Reconciliation may still be ongoing. Do not purchase again automatically.</p>}
        {result.status==='FAILED' && <p className="text-red-700">The provider reported failure. Review transaction history and any reversal before a new attempt.</p>}
      </div>
      <CustomButton type="button" disabled={checking} isLoading={checking} onClick={()=>void checkPurchaseStatus(result.reference)}>Refresh status from {brand.name}</CustomButton>
      <CustomButton type="button" variant="primary" href="/dashboard/history">View transaction history</CustomButton>
      <CustomButton type="button" variant="primary" onClick={clearPrevious}>Start a new purchase after reviewing history</CustomButton>
    </div>}
    <div className="mt-8 border-t border-[#D0D5DD] pt-5 text-sm">
      <button type="button" className="underline text-[#112929]" onClick={()=>setShowRecent(value=>!value)}>{showRecent?'Hide':'Show'} recent bill purchases</button>
      {showRecent && <div className="mt-3 space-y-2">
        {previousPurchases.isLoading && <p role="status" className="text-[#717171]">Loading purchases…</p>}
        {previousPurchases.isError && <p role="alert" className="text-red-700">Unable to load your bill purchases.</p>}
        {previousPurchases.data?.length===0 && <p className="text-[#717171]">No recent bill purchases found.</p>}
        {previousPurchases.data?.filter(p=>p.category===category).slice(0,15).map(p=><button type="button" className="w-full text-left border border-[#D0D5DD] rounded-lg p-3 hover:bg-[#1129290D]" key={p.reference} disabled={checking} onClick={()=>void checkPurchaseStatus(p.reference)}>
          <span className="block font-medium">{p.productName} — {formatNgnMinorUnits(p.amountMinor)}</span>
          <span className="block text-[#667085]">{p.reference} · {p.status}</span>
        </button>)}
      </div>}
    </div>
  </section>;
}
