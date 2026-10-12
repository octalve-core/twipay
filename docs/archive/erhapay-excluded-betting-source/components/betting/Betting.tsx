import { useEffect, useMemo } from "react";

import useIsMobile from "@/hooks/useIsMobile";
import useBettingStore from "@/stores/useBettingStore";
import SelectProvider from "./SelectProvider";
import RecipientDetails from "./RecipientDetails";
import ConfirmBettingPayment from "./ConfirmBettingPayment";
import Status from "./Status";
import { useQuery } from "@tanstack/react-query";
import { getServicesStatus, ServicesData } from "@/lib/api/dashboard-apis/generics";
import Loader from "@/components/Loader";
import EmptyState from "../../EmptyState";


const Betting = () => {
    const isMobile = useIsMobile();

    const { data: servicesStatus, isLoading } = useQuery<ServicesData, Error>({
        queryKey: ["servicesStatus"],
        queryFn: getServicesStatus,
    });

    const statusMsg = servicesStatus?.betting.status !== "active" ? servicesStatus?.betting.message : null;

    
    const BettingServiceSteps = useMemo(() => isMobile 
    ? [
      {
          id: 1,
          component: RecipientDetails
      },
      {
          id: 2,
          component: ConfirmBettingPayment
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
            component: ConfirmBettingPayment
        },
        {
            id: 4,
            component: Status
        },
    ], [isMobile])
    
    const {step, reset} = useBettingStore();
    
    useEffect(() => {
        reset();
    }, [reset]);
    
    if (isMobile === null) return null;

    if (isLoading) return <Loader className="w-full h-full" />;

    if (statusMsg) return <EmptyState showBackBtn={true} text={statusMsg} />;
          
    const CurrentComponent = BettingServiceSteps[step - 1].component;
    
    return (
        <div className="min-h-full flex md:items-center justify-center">
            <CurrentComponent />
        </div>
      )
}

export default Betting