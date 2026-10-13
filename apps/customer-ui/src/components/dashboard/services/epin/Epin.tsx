import useIsMobile from "@/hooks/useIsMobile";
import SelectProvider from "./SelectProvider";
import useEpinStore from "@/stores/useEPinStore";
import { useEffect, useMemo } from "react";
import ConfirmEPinPayment from "./ConfirmEPinPayment";
import Status from "./Status";
import { useQuery } from "@tanstack/react-query";
import { getServicesStatus, ServicesData } from "@/lib/api/dashboard-apis/generics";
import Loader from "@/components/Loader";
import EmptyState from "../../EmptyState";

const Epin = () => {
    const isMobile = useIsMobile();

    const { data: servicesStatus, isLoading } = useQuery<ServicesData, Error>({
        queryKey: ["servicesStatus"],
        queryFn: getServicesStatus,
    });

    const statusMsg = servicesStatus?.education.status !== "active" ? servicesStatus?.education.message : null;

    const EpinServiceSteps = useMemo(() => [
        {
            id: 1,
            component: SelectProvider
        },
        {
            id: 3,
            component: ConfirmEPinPayment
        },
        {
            id: 4,
            component: Status
        },
    ], [])

    const {step, reset, selectedProduct} = useEpinStore();

    void 0;
  
    useEffect(() => {
        reset();
    }, [reset]);

    const CurrentComponent = EpinServiceSteps[step - 1].component;

     if (isMobile === null) return null;

    if (isLoading) return <Loader className="w-full h-full" />;

    if (statusMsg) return <EmptyState showBackBtn={true} text={statusMsg} />;
    
    return (
        <div className="min-h-full flex md:items-center justify-center">
            <CurrentComponent />
        </div>
      )
}

export default Epin