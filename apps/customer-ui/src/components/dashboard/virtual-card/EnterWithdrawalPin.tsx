import { FormEvent, useState } from "react";
import EnterPin from "../EnterPin";
import BackButton from "@/components/Authentication/BackButton";
import useIsMobile from "@/hooks/useIsMobile";
import WithdrawalStatus from "./WithdrawalStatus";
import useVirtualCardWithdraw from "@/stores/useVirtualCardWithdraw";

const EnterWithdrawalPin = () => {
    const [paymenTPin, SetPaymenTPin] = useState<string>("");
    const [status, setStatus] = useState({
      show: false,
      isSuccess: false
    });
    const {update} = useVirtualCardWithdraw()

    const isMobile = useIsMobile();

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
   
       //  Make API call to fund card
        void 0;
   
        setStatus({
          show: true,
          isSuccess: true
        });
       }

       if(status.show) {
        return <WithdrawalStatus isSuccessful={status.isSuccess} />
       }

  return (
    <div className="w-full max-w-[360px]">
      <BackButton icon={isMobile} action={() => update({showPinForm: false})} className="mb-8" /> 
      <h1 className="text-[#112929] font-medium text-2xl max-md:text-center">Confirm withdrawal</h1>
      <p className="text-[#717171] mt-2 max-md:text-center">Enter your transaction pin to confirm this withdrawal</p>

      <EnterPin handleSubmit={handleSubmit} value={paymenTPin} onValueChange={SetPaymenTPin} />
    </div>
  )
}

export default EnterWithdrawalPin;