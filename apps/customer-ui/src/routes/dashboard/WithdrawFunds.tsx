import { WithdrawFundsSteps } from "@/components/dashboard/withdraw-funds/withdraw-funds-steps";
import useWithdrawFundsStore from "@/stores/useWithdrawFunds";
import { useEffect } from "react";

const WithdrawFunds = () => {
    const {step, reset} = useWithdrawFundsStore();

     useEffect(() => {
          reset();
      }, [reset]);

    const CurrentStepComponent = WithdrawFundsSteps[step - 1].component;

  return (
    <div className="w-full min-h-full grid place-items-center">
        <CurrentStepComponent />
    </div>
  )
}

export default WithdrawFunds