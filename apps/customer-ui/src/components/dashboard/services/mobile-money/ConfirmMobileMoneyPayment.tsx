import { FormEvent, useState } from "react"

import { formatAmount } from "@/lib/utils";
import CustomButton from "@/components/CustomButton"
import BackButton from "@/components/Authentication/BackButton"
import EnterPin from "@/components/dashboard/EnterPin";
import useIsMobile from "@/hooks/useIsMobile";
import useMobileMoneyStore from "@/stores/useMobileMoneyStore";

const ConfirmMobileMoneyPayment = () => {
  const [paymenTPin, SetPaymenTPin] = useState<string>("");
  const [showPinForm, setShowPinForm] = useState(false);

  const isMobile = useIsMobile();
  const { update } = useMobileMoneyStore();

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
    //  Make API call to make book event
        void 0;

    // if successful
        update({step: 3, isSuccessful: true});
    }

  return (
    <div className="min-h-full flex md:items-center justify-center">
      {
        showPinForm ? 
          <section className="flex flex-col max-md:justify-center max-md:text-center">
                <BackButton icon={isMobile} action={() => setShowPinForm(false)} className="mb-8" />

                <h1 className="text-[#112929] font-medium text-2xl">Confirm Payment</h1>
                <p className="text-[#717171] mt-2 text-sm md:text-base">Enter your transaction pin to confirm this payment</p>

                <EnterPin handleSubmit={handleSubmit} value={paymenTPin} onValueChange={SetPaymenTPin} />
          </section> :
          <section className="w-full max-w-[358px] mx-auto flex flex-col max-md:justify-center max-md:text-center">
            <BackButton icon={isMobile} action={() => update({step: 1})} className="mb-8" />
            <h1 className="text-[#112929] font-medium text-2xl">Confirm payment</h1>
            <p className="text-[#717171] md:mt-2">Confirm the details of this payment</p>

            <p className="text-[#101828] md:text-xl my-5 md:my-8">You are about to pay <span className="font-medium">{formatAmount(100000)}</span> to <span className="font-medium">0000000000 (MTN MOMO)</span>.</p>
            <CustomButton onClick={() => setShowPinForm(true)} className="w-full mx-auto">Proceed - <span className="opacity-60">Confirm Payment</span></CustomButton>
          </section>
          }
    </div>
  )
}

export default ConfirmMobileMoneyPayment