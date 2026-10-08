import { useEffect, useMemo } from "react";

import RecipientDetails from "./RecipientDetails";
import useIsMobile from "@/hooks/useIsMobile";
import Status from "./Status";
import ConfirmDataPayment from "./ConfirmDataPayment";
import usePurchaseIntDataStore from "@/stores/usePurchaseIntDataStore";
import { useQuery } from "@tanstack/react-query";
import { getServicesStatus, ServicesData } from "@/lib/api/dashboard-apis/generics";
import Loader from "@/components/Loader";
import EmptyState from "../../EmptyState";

const InternationalData = () => {
  const isMobile = useIsMobile();

    const { data: servicesStatus, isLoading } = useQuery<ServicesData, Error>({
        queryKey: ["servicesStatus"],
        queryFn: getServicesStatus,
    });

    const statusMsg = servicesStatus?.internationaldata.status !== "active" ? servicesStatus?.internationaldata.message : null;
  
  const IntDataPurchaseSteps = useMemo(() =>
  [
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
], [])

    const {step, reset} = usePurchaseIntDataStore();

    useEffect(() => {
        reset();
      }, [reset]);

    if (isMobile === null) return null;

  const CurrentComponent = IntDataPurchaseSteps[step - 1].component;

    if (isLoading) return <Loader className="w-full h-full" />;

    if (statusMsg) return <EmptyState showBackBtn={true} text={statusMsg} />;
  
  return (
    <div className="min-h-full flex md:items-center justify-center">
        <CurrentComponent />
    </div>
  )
}

export default InternationalData;