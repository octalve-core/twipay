import { AddFundsSteps } from "@/components/dashboard/add-funds/add-funds-steps";
import useAddFundsStore from "@/stores/useAddFundsStore";
import { useEffect } from "react";

const AddFunds = () => {
    const {step, reset} = useAddFundsStore();

    useEffect(() => {
        reset()
    }, [ reset]);

    const CurrentStepComponent = AddFundsSteps[step - 1].component;

  return (
    <div className="w-full min-h-full grid place-items-center">
        <CurrentStepComponent />
    </div>
  )
}

export default AddFunds;