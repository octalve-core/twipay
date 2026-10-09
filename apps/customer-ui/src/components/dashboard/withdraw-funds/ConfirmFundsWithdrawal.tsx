import { useRef, useState } from 'react';
import BackButton from '@/components/Authentication/BackButton';
import CustomButton from '@/components/CustomButton';
import useIsMobile from '@/hooks/useIsMobile';
import { formatNgnMinorUnits } from '@/lib/money';
import { nairaToMinor } from '@/lib/api/dashboard-apis/funding';
import { initiateBankTransfer,hasTransferAttempt,abandonTransferAttempt } from '@/lib/api/dashboard-apis/transfers';
import useWithdrawFundsStore from '@/stores/useWithdrawFunds';

const sandboxEnabled=import.meta.env.VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED === 'true';
const ConfirmFundsWithdrawal=()=>{
  const isMobile=useIsMobile();
  const {update,amount,bank_account,selectedBank,accountName,provider,note}=useWithdrawFundsStore();
  const [busy,setBusy]=useState(false);
  const inFlight=useRef(false);
  const [error,setError]=useState('');
  const [attemptOpen,setAttemptOpen]=useState(hasTransferAttempt);
  const [ack,setAck]=useState(false);
  async function submit(){
    if(inFlight.current||!sandboxEnabled||!ack||!selectedBank)return;
    inFlight.current=true;setBusy(true);setError('');
    try{
      const response=await initiateBankTransfer({provider,bankCode:selectedBank.bankCode,accountNumber:bank_account,
        accountName,amountNaira:amount,narration:note||'Wallet bank transfer'});
      setAttemptOpen(true);
      update({step:4,txnResult:response});
    }catch(e){
      setAttemptOpen(hasTransferAttempt());
      setError(`${e instanceof Error?e.message:'Transfer submission could not be confirmed'}. Check transaction history before retrying. Please do not start another transfer until its status is confirmed.`);
    }finally{setBusy(false);inFlight.current=false;}
  }
  function resetAttempt(){
    if(!window.confirm('Have you checked your transaction history for the previous transfer? Starting a different attempt can cause another transfer if the earlier request succeeded.'))return;
    abandonTransferAttempt();setAttemptOpen(false);setError('');setAck(false);
  }
  return <div className="min-h-full flex md:items-center justify-center">
    <section className="w-full max-w-[358px] mx-auto flex flex-col max-md:justify-center max-md:text-center">
      <BackButton disabled={busy} icon={isMobile} action={()=>update({step:2})} className="mb-8" />
      <h1 className="text-[#112929] font-medium text-2xl">Confirm Withdrawal</h1>
      <p className="text-[#717171] md:mt-2">Confirm the bank transfer details</p>
      <p className="text-[#101828] md:text-xl my-5 md:my-8">You are about to transfer <span className="font-medium">{formatNgnMinorUnits(nairaToMinor(amount))}</span> to <span className="font-medium">{accountName}</span> ({selectedBank?.name}), account ending {bank_account.slice(-4)}.</p>
      <p className="text-sm text-[#717171] mb-5">Provider: {provider}. Narration: {note}. Your transfer fee is not available to review yet. Please confirm the recipient details and wait until the total charge can be shown.</p>
      <label className="flex items-start gap-2 text-sm mb-5 text-left"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> I have checked the recipient details and understand that the request may remain processing or require reconciliation.</label>
      {error && <p className="text-red-600 text-sm mb-4" role="alert">{error}</p>}
      {!sandboxEnabled && <p className="text-sm text-[#717171] mb-4" role="status">Bank transfers are temporarily unavailable. Your money has not been sent.</p>}
      <CustomButton disabled={!sandboxEnabled||busy||!ack} onClick={()=>void submit()} className="w-full mx-auto">{busy?'Submitting…':'Confirm bank transfer'}</CustomButton>
      {attemptOpen && <CustomButton disabled={busy} onClick={resetAttempt} variant="primary" className="w-full mt-3">Review previous attempt, then start new</CustomButton>}
    </section>
  </div>;
};
export default ConfirmFundsWithdrawal;
