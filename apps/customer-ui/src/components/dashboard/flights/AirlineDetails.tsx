import CustomButton from "@/components/CustomButton";
import BackButton from "@/components/Authentication/BackButton";
import useFlightStore from "@/stores/useFlightStore";
import { Navigate } from "react-router-dom";
import { formatISODuration } from "@/lib/utils";

const AirlineDetails = () => {
    const {selectedAirline, flightType} = useFlightStore();

    if (!selectedAirline) {
        return <Navigate to="/dashboard/book-flight" replace />;
    }
    const airlineData = selectedAirline.itineraries.to[0].airline;
    const isAirlineObject = typeof airlineData === "object"

    const airlineName = isAirlineObject ? airlineData.name : airlineData as string;
    const flightDuration = selectedAirline.itineraries.to[0].itinerary_duration;
    const arrivalIn = selectedAirline.itineraries.to[0].arrive_in;
    const departureFrom = selectedAirline.itineraries.to[0].depart_from;
    const arrivalTime = selectedAirline.itineraries.to[0].arrive_at.three
    const departureTime = selectedAirline.itineraries.to[0].depart_at.three

  return (
    <div className="min-h-full flex md:items-center justify-center">
        <section className="w-full max-w-[360px] mx-auto">
            <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
                <BackButton icon href="/dashboard/book-flight"/>
                <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Flight details</p>
            </div>

            <div className="max-md:hidden">
                <BackButton href="/dashboard/book-flight" className="mb-8" />
                <h1 className="text-2xl font-medium text-[#112929] hidden md:block">Airline details</h1>
                <p className="text-[#717171] mt-2 mb-8">Kindly confirm your flight details below.</p>
            </div>
            <p className="text-[#344054] text-center md:hidden mt-14 mb-10">Kindly confirm your flight details below.</p>
            <div className="p-4 flex flex-col gap-4 md:gap-6 border border-[#475467]/20 rounded-lg">
                <div className="flex w-full justify-between items-center">
                    <p className="text-[#464E60] text-sm md:text-base">Airline</p>
                    <p className="text-[#1877F2] text-sm md:text-base font-medium text-right">{airlineName}</p>
                </div>
                <div className="flex w-full justify-between items-center">
                    <p className="text-[#464E60] text-sm md:text-base">Flight class</p>
                    <p className="text-[#464E60] text-sm md:text-base font-medium text-right">{flightType}</p>
                </div>
                <div className="flex w-full justify-between items-center">
                    <p className="text-[#464E60] text-sm md:text-base">Trip duration</p>
                    <p className="text-[#464E60] text-sm md:text-base font-medium text-right">{formatISODuration(flightDuration)}</p>
                </div>
                <div className="flex w-full justify-between items-center">
                    <p className="text-[#464E60] text-sm md:text-base">Boarding</p>
                    <p className="text-[#464E60] text-sm md:text-base font-medium text-right">{departureFrom}</p>
                </div>
                <div className="flex w-full justify-between items-center">
                    <p className="text-[#464E60] text-sm md:text-base">Arrivals</p>
                    <p className="text-[#464E60] text-sm md:text-base font-medium text-right">{arrivalIn}</p>
                </div>
                <div className="flex w-full justify-between items-center">
                    <p className="text-[#464E60] text-sm md:text-base">Departure time</p>
                    <p className="text-[#464E60] text-sm md:text-base font-medium text-right">{departureTime}</p>
                </div>
                <div className="flex w-full justify-between items-center">
                    <p className="text-[#464E60] text-sm md:text-base">Arrival time</p>
                    <p className="text-[#464E60] text-sm md:text-base font-medium text-right">{arrivalTime}</p>
                </div>
            </div>

            <div className="w-full mt-8 max-w-[410px] mx-auto">
                <CustomButton href="/dashboard/flight/passenger-info" className="w-full inline-block text-center">Proceed - <span className="opacity-60">Passenger info</span></CustomButton>
            </div>
        </section>
    </div>
  )
}

export default AirlineDetails