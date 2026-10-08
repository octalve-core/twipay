import { cn } from "@/lib/utils";
import CustomButton from "@/components/CustomButton";
import useAddFundsStore from "@/stores/useAddFundsStore";
import BackButton from "@/components/Authentication/BackButton";
import { MdRadioButtonChecked, MdRadioButtonUnchecked } from "react-icons/md";
import { initiateFunding, nairaToMinor, hasOpenFundingAttempt, abandonFundingAttempt, type FundingProvider } from "@/lib/api/dashboard-apis/funding";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

// Based only on supported FinanceController provider enum, not a fabricated providers API.
export type TPaymentProvider = { name: string; code: FundingProvider };
const paymentProviders: TPaymentProvider[] = [
  {name:"Paystack", code:"paystack"},
  {name:"Monnify", code:"monnify"},
];
const sandboxEnabled = import.meta.env.VITE_TWIPAY_FUNDING_SANDBOX_ENABLED === "true";

const SelectPaymentMethod = () => {
  const {update, paymentMethod, amount} = useAddFundsStore();
  const submitting = useRef(false);
  const [hasExistingAttempt, setHasExistingAttempt] = useState(hasOpenFundingAttempt);
  const mutation = useMutation({
    mutationFn: ({provider, naira}: {provider:FundingProvider;naira:string}) => initiateFunding(provider, naira),
    onSuccess: (data) => {
      // Neither collection initiation nor checkout redirect establishes a paid balance.
      update({generatedAccount:data, step:3});
    },
    onError: (error:Error) => {
      toast.error(error.message || "Funding could not be initiated. Review your history before retrying.");
    },
    onSettled: () => {submitting.current = false;},
  });
  const handlePaymentMethod = () => {
    if (!sandboxEnabled || !paymentMethod || submitting.current || mutation.isPending) return;
    try {nairaToMinor(amount);} catch(e) {toast.error((e as Error).message);return;}
    submitting.current = true;
    mutation.mutate({provider:paymentMethod.code,naira:amount});
  };
  return (
    <section className="w-full max-w-[360px] mx-auto max-md:self-start">
      <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
        <BackButton icon action={() => update({step:1})}/>
        <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Fund account</p>
      </div>
      <p className="text-sm text-[#1C1C1CCC] mt-14 mb-5 md:hidden">Select a secure checkout provider</p>
      <div className="max-md:hidden">
        <BackButton className="mb-8" action={() => update({step:1})}/>
        <h1 className="text-[#112929] font-medium text-2xl">Add funds</h1>
        <p className="text-[#717171] mt-2">Select a payment provider</p>
      </div>
      <div className="w-full max-w-[360px] mx-auto md:mt-5 flex flex-col gap-2 md:gap-5">
        {paymentProviders.map(prov => (
          <button type="button" key={prov.code} onClick={() => update({paymentMethod:prov})}
            aria-pressed={paymentMethod?.code === prov.code}
            className={cn("w-full rounded-[5px] px-3.5 border bg-white h-[54px] flex items-center gap-2 transition cursor-pointer hover:border-[#112929]",paymentMethod?.code === prov.code ? "border-[#112929]" : "border-transparent")}>
            <span className="size-[26px] rounded-md grid place-items-center bg-[#1129290D] text-[#112929] text-xs font-semibold" aria-hidden="true">{prov.name.slice(0,1)}</span>
            <span className="text-sm text-[#31373D]">{prov.name}</span>
            <span className="ml-auto">{paymentMethod?.code === prov.code
              ? <MdRadioButtonChecked className="size-4 text-[#112929]"/>
              : <MdRadioButtonUnchecked className="size-4 text-[#1C1C1C99]"/>}</span>
          </button>
        ))}
      </div>
      {sandboxEnabled && hasExistingAttempt && <div className="mt-4 text-sm text-[#667085]">
        <p>Previous funding may still be processing. <Link className="underline" to="/dashboard/history">Review your transaction history</Link> before creating another payment.</p>
        <button type="button" className="underline mt-2 text-[#112929]" onClick={() => {
          if (mutation.isPending || submitting.current) return;
          if (window.confirm("Have you checked your prior payment status? Starting a new payment may create another debit. Continue only if you intend a separate payment.")) {
            abandonFundingAttempt();
            setHasExistingAttempt(false);
            update({paymentMethod:null});
          }
        }}>Start a separate funding attempt</button>
      </div>}
      {!sandboxEnabled && <p role="status" className="mt-4 text-sm text-[#667085]">Wallet funding will be enabled after sandbox verification. No payments are being accepted.</p>}
      <CustomButton type="button" isLoading={mutation.isPending} disabled={!sandboxEnabled || mutation.isPending || !paymentMethod}
        onClick={handlePaymentMethod} className="mt-10 md:mt-5 w-full">
        {mutation.isPending ? "Initializing checkout…" : "Proceed - Payment"}
      </CustomButton>
    </section>
  );
};
export default SelectPaymentMethod;
