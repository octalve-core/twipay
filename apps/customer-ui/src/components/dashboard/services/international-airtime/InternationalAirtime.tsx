import { useEffect, useMemo } from "react";

import RecipientDetails from "./RecipientDetails";
import useIsMobile from "@/hooks/useIsMobile";
import ConfirmAirtimePayment from "./ConfirmAirtimePayment";
import Status from "./Status";
import usePurchaseIntAirtimeStore from "@/stores/usePurchaseIntAirtimeStore";
import { useQuery } from "@tanstack/react-query";
import { getServicesStatus, ServicesData } from "@/lib/api/dashboard-apis/generics";
import Loader from "@/components/Loader";
import EmptyState from "../../EmptyState";

const InternationalAirtime = () => {
  const isMobile = useIsMobile();

    const { data: servicesStatus, isLoading } = useQuery<ServicesData, Error>({
        queryKey: ["servicesStatus"],
        queryFn: getServicesStatus,
    });

    const statusMsg = servicesStatus?.internationalairtime.status !== "active" ? servicesStatus?.internationalairtime.message : null;
  
  const IntAirtimePurchaseSteps = useMemo(() =>
  [
    {
        id: 1,
        component: RecipientDetails
    },
    {
        id: 2,
        component: ConfirmAirtimePayment
    },
    {
        id: 3,
        component: Status
    },
], [])

    const {step, reset} = usePurchaseIntAirtimeStore();

    useEffect(() => {
        reset();
      }, [reset]);

    if (isMobile === null) return null;

  const CurrentComponent = IntAirtimePurchaseSteps[step - 1].component;

    if (isLoading) return <Loader className="w-full h-full" />;

    if (statusMsg) return <EmptyState showBackBtn={true} text={statusMsg} />;
  
  return (
    <div className="min-h-full flex md:items-center justify-center">
        <CurrentComponent />
    </div>
  )
}

export default InternationalAirtime;