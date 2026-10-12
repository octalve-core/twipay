import SelectHotel from "@/components/dashboard/hotels/SelectHotel";
import HotelDetails from "../../components/dashboard/hotels/HotelDetails";
import { useQuery } from "@tanstack/react-query";
import { getServicesStatus, ServicesData } from "@/lib/api/dashboard-apis/generics";
import Loader from "@/components/Loader";
import EmptyState from "@/components/dashboard/EmptyState";

const Hotels = () => {
    const { data: servicesStatus, isLoading } = useQuery<ServicesData, Error>({
        queryKey: ["servicesStatus"],
        queryFn: getServicesStatus,
    });

    const statusMsg = servicesStatus?.hotel.status !== "active" ? servicesStatus?.hotel.message : null;

    if (isLoading) return <Loader className="w-full h-full" />;

    if (statusMsg) return <EmptyState showBackBtn={true} text={statusMsg} />;

  return (
    <div className="flex justify-center max-md:self-start">
        <section className="w-full max-w-[879px] flex md:gap-16">
          <SelectHotel />
          <div className="h-[80vh] w-[1px] self-start bg-[#6670854D] sticky top-0 hidden md:block" />
          <HotelDetails />
        </section>
    </div>
  )
}

export default Hotels;