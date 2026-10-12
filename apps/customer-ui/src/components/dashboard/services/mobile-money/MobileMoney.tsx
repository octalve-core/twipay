import { useEffect } from "react";

import useMobileMoneyStore from "@/stores/useMobileMoneyStore";
import { MobileMoneySteps } from "./constants";

const MobileMoney = () => {  
  const {step, reset} = useMobileMoneyStore();

      useEffect(() => {
          reset();
        }, [reset]);

  const CurrentComponent = MobileMoneySteps[step - 1].component;
  
  return (
    <div className="min-h-full flex md:items-center justify-center">
        <CurrentComponent />
    </div>
  )
}

export default MobileMoney;