import { useEffect } from "react";
import useTVCableStore from "@/stores/useTVCableStore";

import { TVCableServiceSteps } from "./constants";
import { getServicesStatus, ServicesData } from "@/lib/api/dashboard-apis/generics";
import { useQuery } from "@tanstack/react-query";
import Loader from "@/components/Loader";
import EmptyState from "../../EmptyState";


const TVCable = () => {
    const {step, reset} = useTVCableStore();

    const { data: servicesStatus, isLoading } = useQuery<ServicesData, Error>({
        queryKey: ["servicesStatus"],
        queryFn: getServicesStatus,
    });

    const statusMsg = servicesStatus?.cable_tv.status !== "active" ? servicesStatus?.cable_tv.message : null;

    
    useEffect(() => { reset() }, [reset]);
    
    const CurrentComponent = TVCableServiceSteps[step - 1].component;

    if (isLoading) return <Loader className="w-full h-full" />;

    if (statusMsg) return <EmptyState showBackBtn={true} text={statusMsg} />;
    
    return (
        <div className="min-h-full flex md:items-center justify-center">
            <CurrentComponent />
        </div>
      )
}

export default TVCable;