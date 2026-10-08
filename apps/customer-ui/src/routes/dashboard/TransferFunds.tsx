import { TransferFundsSteps } from "@/components/dashboard/transfer-funds/transfer-funds-steps";
import useTransferFundsStore from "@/stores/useTransferFundsStore";
import { useEffect } from "react";

const TransferFunds = () => {
    const {step, reset} = useTransferFundsStore();

    useEffect(() => {
        reset();
    }, [reset]);

    const CurrentStepComponent = TransferFundsSteps[step - 1].component;

  return (
    <div className="w-full min-h-full grid place-items-center">
        <CurrentStepComponent />
    </div>
  )
}

export default TransferFunds