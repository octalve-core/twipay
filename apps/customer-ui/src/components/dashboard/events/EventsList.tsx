import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
  } from "@/components/ui/pagination"
import { DummyEventsArray } from "./constants";
import { formatAmount } from "@/lib/utils";
import { LuClock3, LuSearch, LuTag } from "react-icons/lu";
import { HiOutlineLocationMarker } from "react-icons/hi";

import BackButton from "@/components/Authentication/BackButton";
import { useNavigate } from "react-router-dom";
import useEventsStore from "@/stores/useEventsStore";


const EventsList = () => {
    const {selectedEvent, update} = useEventsStore();
    const navigate = useNavigate()

  return (
    <div className="w-full">
        <div className="max-md:hidden">
            <BackButton className="mb-8" action={() => navigate(-1)} />
            <h1 className="text-[#112929] text-2xl font-medium">Select Events</h1>
            <p className=" text-[#344054]">Please select the event you want to attend</p>
        </div>
        
        <div className="relative mt-16 md:mt-2">
            <input placeholder="Search events" className="w-full h-12  bg-white border border-[#344054]/20 focus:outline-[#112929]/50 rounded-lg overflow-hiddenoutline-0 placeholder:text-xs placeholder:text-[#344054] pl-10" />
            <span className="absolute left-4 top-1/2 -translate-y-1/2"><LuSearch className="text-[#344054] size-4" /></span>
        </div>

        <section className="mt-5">
            <div className="flex flex-col gap-5">
                {
                    DummyEventsArray.map((event) => (
                        <button
                            onClick={() => update({ selectedEvent: selectedEvent === event.id ? null : event.id})} 
                            key={event.id} 
                            className="relative bg-white border border-transparent hover:border-[#112929] col-span-full md:col-span-1 rounded-md p-3 transition cursor-pointer hover:opacity-90"
                        >
                            <div className="flex items-center gap-3 mb-2.5 pt-2">
                                <img src={event.image} alt={event.name} className="size-10 object-cover rounded-full" />
                                <h2 className="font-bold text-xl text-[#334054]">{event.name}</h2>
                            </div>
                            <p className="font-medium text-xs text-[#667085] text-left mb-3 opacity-80">{event.desc}</p>
                            <div className="flex gap-2 items-center text-[#475367]">
                                <div className="flex items-center gap-1">
                                    <HiOutlineLocationMarker className="size-4 opacity-50" />
                                    <span className="text-xs">{event.location}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <LuClock3 className="size-4 opacity-50" />
                                    <span className="text-xs">11:30 AM - 12:30 PM</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <LuTag className="size-4 opacity-50" />
                                    <span className="text-sm">{formatAmount(event.amount)}</span>
                                </div>
                            </div>
                        </button>
                    ))
                }
            </div>
        </section>

        <section className="mt-5 mb-8 py-3 px-6 w-full">
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
        </section>
    </div>
  )
}

export default EventsList