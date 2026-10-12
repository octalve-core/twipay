import { FormEvent, useState } from "react"

import { formatAmount } from "@/lib/utils";
import CustomButton from "@/components/CustomButton"
import BackButton from "@/components/Authentication/BackButton"
import EnterPin from "@/components/dashboard/EnterPin";
import useIsMobile from "@/hooks/useIsMobile";
import usePurchaseDataStore from "@/stores/usePurchaseDataStore";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AxiosError } from "axios";
import { buyData } from "@/lib/api/dashboard-apis/servicesApis";

const ConfirmDataPayment = () => {
  const [paymenTPin, SetPaymenTPin] = useState<string>("");
  const [showPinForm, setShowPinForm] = useState(false);

  const isMobile = useIsMobile();
  const { update, step, phone, type, plan, dataPlans } = usePurchaseDataStore();

  const planName = dataPlans.find((dataPlan) => dataPlan.id === plan)?.name
  const planAmount = dataPlans.find((dataPlan) => dataPlan.id === plan)?.amount

  const {mutate, isPending} = useMutation({
      mutationFn: buyData,
      onSuccess: (data) => {
        update({step: step+1, txnResult: data});
      },
      onError: (error: AxiosError) => {
        (void 0)
          update({step: step+1, txnResult: null});
          const errData = error.response?.data as { message?: string };
          if(errData.message){
              return toast.error(errData.message)
          }
          toast.error("Something went wrong, please try again")
      }
  })

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        mutate({phone, pin: paymenTPin, type, productId:plan })
    }

  return (
    <div className="min-h-full flex md:items-center justify-center">
      {
        showPinForm ? 
          <section className="flex flex-col max-md:justify-center max-md:text-center">
                <BackButton disabled={isPending} icon={isMobile} action={() => setShowPinForm(false)} className="mb-8" />

                <h1 className="text-[#112929] font-medium text-2xl">Confirm Payment</h1>
                <p className="text-[#717171] mt-2 text-sm md:text-base">Enter your transaction pin to confirm this payment</p>

                <EnterPin disable={isPending} handleSubmit={handleSubmit} value={paymenTPin} onValueChange={SetPaymenTPin} />
          </section> :
          <section className="w-full max-w-[358px] mx-auto flex flex-col max-md:justify-center max-md:text-center">
            <BackButton disabled={isPending} icon={isMobile} action={() => update({step: step-1})} className="mb-8" />
            <h1 className="text-[#112929] font-medium text-2xl">Confirm purchase</h1>
            <p className="text-[#717171] md:mt-2">Confirm the details of this purchase</p>

            <p className="text-[#101828] md:text-xl my-5 md:my-8">You are about to purchase <span className="font-medium">{planName}</span> for <span className="font-medium">{formatAmount(planAmount as number)}</span> on <span className="font-medium">{phone}</span>.</p>
            <CustomButton disabled={isPending} onClick={() => setShowPinForm(true)} className="w-full mx-auto">Proceed - <span className="opacity-60">Confirm Purchase</span></CustomButton>
          </section>
          }
    </div>
  )
}

export default ConfirmDataPayment