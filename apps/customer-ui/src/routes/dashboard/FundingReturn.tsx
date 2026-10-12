import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getFundingStatus, lastFundingReference, type FundingStatusDetail } from "@/lib/api/dashboard-apis/funding";
import { formatNgnMinorUnits } from "@/lib/money";
/** Provider redirects are untrusted. Only an owner-scoped API response can report a confirmed credit. */
export default function FundingReturn() {
  const [reference] = useState(lastFundingReference);
  const [status,setStatus] = useState<FundingStatusDetail|null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  async function refresh(){
    if(!reference || busy)return;
    setBusy(true);setError('');
    try { setStatus(await getFundingStatus(reference)); }
    catch { setStatus(null);setError('We could not confirm this payment yet. Check your transaction history before trying again.'); }
    finally{setBusy(false);}
  }
  useEffect(()=>{
    if(!reference)return;
    let live=true;
    void getFundingStatus(reference).then(result=>{if(live)setStatus(result)})
      .catch(()=>{if(live)setError('Your payment is not yet confirmed. Check transaction history.')});
    return()=>{live=false};
  },[reference]);
  return <main className="w-full min-h-screen grid place-items-center px-5">
    <section className="w-full max-w-[360px] text-center">
      <h1 className="text-[#112929] font-medium text-2xl">Check your payment</h1>
      <p className="text-[#667085] text-sm mt-4">Returning from the provider does not confirm payment. Your wallet is credited only after TwiPay verifies the transaction.</p>
      {reference && <p className="text-xs mt-4 break-all text-[#667085]">Reference: {reference}</p>}
      {status && <div className="mt-5 text-sm" role="status">
        <p>Payment: <strong>{status.status}</strong></p>
        <p>Requested amount: {formatNgnMinorUnits(status.amountMinor)}</p>
        {status.status !== 'SUCCEEDED' && <p className="mt-2 text-[#667085]">Please do not repeat this payment while the outcome is being checked.</p>}
      </div>}
      {error && <p className="mt-4 text-red-600 text-sm" role="alert">{error}</p>}
      {reference && <button type="button" disabled={busy} className="block w-full rounded-lg border border-[#112929] py-3 mt-6" onClick={()=>void refresh()}>{busy?'Checking…':'Refresh verified status'}</button>}
      <Link className="block rounded-[8px] py-3 bg-[#112929] text-white mt-4" to={reference?`/dashboard/history/${encodeURIComponent(reference)}`:'/dashboard/history'}>View transaction history</Link>
    </section>
  </main>;
}
