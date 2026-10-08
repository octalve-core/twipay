import { LuFolder } from 'react-icons/lu';
import CustomButton from '@/components/CustomButton';
import { formatNgnMinorUnits } from '@/lib/money';
import { nairaToMinor } from '@/lib/api/dashboard-apis/funding';
import useWithdrawFundsStore from '@/stores/useWithdrawFunds';
import SuccessIcon from '@/assets/dashboard/success_icon.svg';
import FailedIcon from '@/assets/dashboard/fail_icon.svg';

const Status = () => {
  const {txnResult,amount,accountName,bank_account,selectedBank} = useWithdrawFundsStore();
  const succeeded=txnResult?.status==='SUCCEEDED';
  const failed=txnResult?.status==='FAILED'||txnResult?.status==='REVERSED';
  const message=succeeded?'Transaction successful':failed?'Transaction not completed':'Transfer awaiting confirmation';
  return <div className="grid place-items-center min-h-full w-full">
    <section className="w-full max-w-[325px] flex flex-col items-center">
      {succeeded||failed?<img alt="" className="h-[113px] w-[124px] md:w-[175px] md:h-[160px] object-cover" src={succeeded?SuccessIcon:FailedIcon}/>:null}
      <h1 className="font-medium text-2xl text-[#112929] mt-2">{message}</h1>
      <p className="md:text-xl text-center mt-3 mb-12 md:my-10 max-md:text-[#717171]">Transfer of <strong>{formatNgnMinorUnits(nairaToMinor(amount))}</strong> to <strong>{accountName}</strong>, account ending {bank_account.slice(-4)} ({selectedBank?.name}): <strong>{txnResult?.status??'Unknown'}</strong>.</p>
      {!succeeded && <p className="text-center text-sm text-[#717171] mb-5">Do not resend a different transfer while the previous attempt may still be processing. The server and provider must confirm the final outcome.</p>}
      {txnResult?.transactionReference && <p className="text-xs break-all text-[#717171] mb-5">Reference: {txnResult.transactionReference}</p>}
      <div className="flex flex-col items-center w-full gap-2">
        <CustomButton className="w-full text-center" href="/dashboard">Return to dashboard</CustomButton>
        {txnResult?.transactionReference && <CustomButton href={`/receipt?txnId=${encodeURIComponent(txnResult.transactionReference)}`} variant="primary" className="flex items-center justify-center gap-3 w-full md:border border-[#112929] font-medium text-[#112929] bg-transparent"><LuFolder className="size-6"/><span>Transaction status and details</span></CustomButton>}
      </div>
    </section>
  </div>;
};
export default Status;
