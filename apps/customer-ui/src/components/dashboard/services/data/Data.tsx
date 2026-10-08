import { useEffect, useMemo } from "react";

import useIsMobile from "@/hooks/useIsMobile";
import RecipientDetails from "./RecipientDetails";
import SelectProvider from "./SelectProvider";
import usePurchaseDataStore from "@/stores/usePurchaseDataStore";
import ConfirmDataPayment from "./ConfirmDataPayment";
import Status from "./Status";
import { getServicesStatus, ServicesData } from "@/lib/api/dashboard-apis/generics";
import { useQuery } from "@tanstack/react-query";
import Loader from "@/components/Loader";
import EmptyState from "../../EmptyState";

const Data = () => {
  const isMobile = useIsMobile();

    const { data: servicesStatus, isLoading } = useQuery<ServicesData, Error>({
        queryKey: ["servicesStatus"],
        queryFn: getServicesStatus,
    });

    const statusMsg = servicesStatus?.data.status !== "active" ? servicesStatus?.data.message : null;
  
  const DataPurchaseSteps = useMemo(() => isMobile 
  ? [
    {
        id: 1,
        component: RecipientDetails
    },
    {
        id: 2,
        component: ConfirmDataPayment
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
          component: ConfirmDataPayment
      },
      {
          id: 4,
          component: Status
      },
  ], [isMobile])

  const {step, reset} = usePurchaseDataStore();

    useEffect(() => {
        reset();
    }, [reset]);

    if (isMobile === null) return null;

  const CurrentComponent = DataPurchaseSteps[step - 1].component;

    if (isLoading) return <Loader className="w-full h-full" />;

    if (statusMsg) return <EmptyState showBackBtn={true} text={statusMsg} />;
  
  return (
    <div className="min-h-full flex md:items-center justify-center">
        <CurrentComponent />
    </div>
  )
}

export default Data;