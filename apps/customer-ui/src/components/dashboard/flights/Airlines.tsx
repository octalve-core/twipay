import CustomButton from "@/components/CustomButton"

// import {
//     Pagination,
//     PaginationContent,
//     PaginationEllipsis,
//     PaginationItem,
//     PaginationLink,
//     PaginationNext,
//     PaginationPrevious,
//   } from "@/components/ui/pagination"
import useFlightStore from "@/stores/useFlightStore";
import { cn, formatAmount, formatDate } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import BackButton from "@/components/Authentication/BackButton";


const Airlines = () => {
    const navigate = useNavigate();

    const {selectedAirline, airlines, fromLocation, toLocation, update, reset} = useFlightStore();

    const handleSelectAirline = () => {
    // route to single airline page with selected airline id

        navigate(`/dashboard/airline/${selectedAirline?.id}`)
    }

  return (
        <section className={cn("w-full md:pt-14 md:sticky top-0 md:h-[80vh] md:overflow-y-auto hide-scrollbar mx-auto",!airlines.length && "max-md:hidden")}>
            <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[747px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
              <BackButton icon action={() => reset()}/>
              <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Available airlines</p>
            </div>

            <div className="">
                <div className="max-md:hidden">
                    <h1 className="text-[#112929] text-2xl font-medium">Select airline</h1>
                    <p className="text-[#717171] font-medium mt-2">Please select the flight you want to book</p>
                </div>
                <p className="mt-14 md:mt-8 mb-1 text-[#344054] font-medium">{formatDate(new Date().toISOString()).toLowerCase()}</p>
                <p className="text-[#667085] font-medium text-sm">{airlines.length} airlines available from {fromLocation?.name} to {toLocation?.name} Today.</p>
            </div>

            <section className="mt-5 md:mt-8">
                <div className="flex flex-col gap-5">
                    {
                        airlines.length > 0 ? airlines.map((airline) => {
                            const airlineData = airline.itineraries.to[0].airline;
                            const isAirlineObject = typeof airlineData === "object" && airlineData !== null;

                            const airlineImage = isAirlineObject ? airlineData.logo : null;
                            const airlineName = isAirlineObject ? airlineData.name : airlineData as string;
                            const flightPrice = airline.price;
                            const arrivalTime = airline.itineraries.to[0].arrive_at.two.split(" ")[1].slice(0, 5);
                            const departureTime = airline.itineraries.to[0].depart_at.two.split(" ")[1].slice(0, 5);

                           return ( 
                            <button onClick={() => update({ selectedAirline: selectedAirline === airline ? null : airline})} key={airline.id} className={cn("rounded-lg p-4 border border-[#475467]/20 hover:border-[#1570EF] transition cursor-pointer", selectedAirline === airline && "border-[#1570EF] bg-[#1570EF]/5")}>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-[#1570EF] text-sm ">{airlineName}</h2>
                                    <p className="font-medium text-[#344054]">{airline.currency} {formatAmount(parseInt(flightPrice))}</p>
                                </div>
                                <div className="py-2.5 flex items-center justify-between gap-2.5">
                                    <div className="">
                                       <p className="font-medium text-[#344054]">{departureTime}</p>
                                        <p className="text-sm uppercase text-[#667085]">{fromLocation?.code}</p>
                                    </div>
                                    <div className="flex items-center w-full">
                                        <div className="w-full h-[1px] bg-[#D0D5DD]/30" />
                                        <img src={airlineImage || ""} className="size-9 object-cover" />
                                        <div className="w-full h-[1px] bg-[#D0D5DD]/30" />
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium text-[#344054]">{arrivalTime}</p>
                                        <p className="text-sm uppercase text-[#667085]">{toLocation?.code}</p>
                                    </div>
                                </div>
                            </button>
                        )}) : null
                    }
                </div>
            </section>

            {/* <section className="mt-5 mb-8 py-3 px-6">
                <Pagination>
                    <PaginationContent className="flex items-center justify-between w-full">
                        <PaginationItem>
                            <PaginationPrevious className="font-medium text-sm rounded-lg border border-[#D0D5DD] hover:bg-[#D0D5DD]/20 transition py-2 px-3.5" href="#" />
                        </PaginationItem>
                        <div className="flex items-center">
                            <PaginationItem>
                                <PaginationLink className="font-medium text-sm rounded-lg p-3 bg-[#F9F5FF]" href="#">1</PaginationLink>
                            </PaginationItem>
                            <PaginationItem>
                                <PaginationEllipsis />
                            </PaginationItem>
                            <PaginationItem>
                                <PaginationLink className="font-medium text-sm" href="#">5</PaginationLink>
                            </PaginationItem>
                        </div>
                        <PaginationItem>
                            <PaginationNext className="font-medium text-sm rounded-lg border border-[#D0D5DD] hover:bg-[#D0D5DD]/20 transition py-2 px-3.5" href="#" />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </section> */}

                        
            <div className="w-full max-w-[410px] mx-auto mt-10">
                <CustomButton disabled={!selectedAirline} onClick={handleSelectAirline} className="w-full">Proceed - <span className="opacity-60">Airline details</span></CustomButton>
            </div>
        </section>
  )
}

export default Airlines