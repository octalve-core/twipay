import { useEffect, useMemo } from "react";

import useIsMobile from "@/hooks/useIsMobile";
import SelectProvider from "./SelectProvider";
import RecipientDetails from "./PurchaseDetails";
import useESimStore from "@/stores/useESimStore";
import ConfirmESimPayment from "./ConfirmESimPayment";
import Status from "./Status";

const ESim = () => {
    const isMobile = useIsMobile();

    const ESimServiceSteps = useMemo(() => isMobile 
    ? [
      {
          id: 1,
          component: RecipientDetails
      },
      {
          id: 2,
          component: ConfirmESimPayment
      },
      {
          id: 3,
          component: Status
      },
  ] :  [
        {
            id: 1,
            component: SelectProvider
        },
        {
            id: 2,
            component: RecipientDetails
        },
        {
            id: 3,
            component: ConfirmESimPayment
        },
        {
            id: 4,
            component: Status
        },
    ], [isMobile])

    const {step, reset} = useESimStore();
  
    useEffect(() => {
        reset();
      }, [reset]);

    if (isMobile === null) return null;
          
    const CurrentComponent = ESimServiceSteps[step - 1].component;
    
    return (
        <div className="min-h-full flex md:items-center justify-center">
            <CurrentComponent />
        </div>
      )
}

export default ESim