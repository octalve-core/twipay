import CustomButton from "@/components/CustomButton";
import useAddFundsStore from "@/stores/useAddFundsStore";
import { formatNgnMinorUnits } from "@/lib/money";
import { nairaToMinor, safeCheckoutUrl, getFundingStatus, type FundingStatusDetail } from "@/lib/api/dashboard-apis/funding";
import BackButton from "@/components/Authentication/BackButton";
import { useNavigate } from "react-router-dom";
import { copyToClipboard } from "@/lib/utils";
import { PiCopy } from "react-icons/pi";
import { useState } from "react";

const MakePayment = () => {
  const navigate = useNavigate();
  const [verified,setVerified] = useState<FundingStatusDetail|null>(null);
  const [checking,setChecking] = useState(false);
  const [checkError,setCheckError] = useState('');
  const {generatedAccount, paymentMethod, amount} = useAddFundsStore();
  if (!generatedAccount) return null;
  const checkoutUrl = safeCheckoutUrl(generatedAccount.checkoutUrl,generatedAccount.provider);
  const amountDisplay = generatedAccount.amountMinor ? formatNgnMinorUnits(generatedAccount.amountMinor)
    : formatNgnMinorUnits(nairaToMinor(amount));
  const pending = ["PENDING", "PROCESSING"].includes(generatedAccount.status);
  const review = generatedAccount.status === "UNKNOWN";
  async function checkStatus() {
    setChecking(true);setCheckError('');
    try {setVerified(await getFundingStatus(generatedAccount!.transactionReference));}
    catch {setCheckError('Could not confirm payment status. Review your history before retrying.');}
    finally{setChecking(false);}
  }
  return (
    <section className="w-full max-w-[360px] mx-auto">
      <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
        <BackButton icon action={() => navigate('/dashboard/history')}/>
        <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Payment details</p>
      </div>
      <div className="max-md:hidden">
        <BackButton className="mb-8" action={() => navigate('/dashboard/history')}/>
        <h1 className="text-[#112929] font-medium text-2xl">Add funds</h1>
        <p className="text-[#717171] mt-2">Secure checkout with {paymentMethod?.name ?? generatedAccount.provider}</p>
      </div>
      <div className="flex flex-col w-full max-w-[360px] mx-auto mt-9">
        <h2 className="text-sm text-[#333333AB]">Amount requested</h2>
        <p className="text-[#00128F] text-xl md:text-2xl font-bold">{amountDisplay}</p>
        <div className="w-full bg-[#BBBBBB4D] mt-[15px] mb-[13px] h-[0.6px]"/>
        <h2 className="text-sm text-[#333333AB]">Transaction reference</h2>
        <div className="flex items-center gap-2 break-all">
          <p className="text-[#31373D] text-sm font-medium">{generatedAccount.transactionReference}</p>
          <button type="button" aria-label="Copy transaction reference"
            onClick={() => void copyToClipboard(generatedAccount.transactionReference)}
            className="grid place-items-center cursor-pointer size-[26px] shrink-0 bg-[#745DB11A] text-[#00128F] rounded-[3px]">
            <PiCopy className="size-4"/>
          </button>
        </div>
        <div className="w-full bg-[#BBBBBB4D] mt-[15px] mb-[13px] h-[0.6px]"/>
        <h2 className="text-sm text-[#333333AB]">Funding status</h2>
        <p role="status" className="text-[#31373D] text-sm mt-1">{verified ? verified.status : review ? "Checking payment status" : generatedAccount.status}</p>
        <p className="text-[#667085] text-sm mt-4">
          {review ? "We’re still checking this payment. Please check its status before trying again." :
            pending ? "Your wallet will be updated once your payment is confirmed." :
            "View your transaction history for the latest payment status."}
        </p>
        {pending && checkoutUrl && <CustomButton type="button" onClick={() => {window.location.assign(checkoutUrl);}}
          className="w-full mt-8">Continue to secure checkout</CustomButton>}
        {pending && !checkoutUrl && <p className="text-sm text-red-600 mt-4" role="alert">We can’t open checkout right now. Please don’t send money using old payment details.</p>}
        {checkError && <p role="alert" className="text-red-600 text-sm mt-4">{checkError}</p>}
        <CustomButton type="button" disabled={checking} onClick={()=>void checkStatus()} className="w-full mt-4">{checking?'Checking…':'Refresh verified status'}</CustomButton>
        <CustomButton type="button" onClick={() => navigate(`/dashboard/history/${encodeURIComponent(generatedAccount.transactionReference)}`)}
          className="w-full mt-4">View transaction status</CustomButton>
      </div>
    </section>
  );
};
export default MakePayment;
