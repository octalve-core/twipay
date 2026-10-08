import { useCallback, useEffect, useRef, useState } from "react";

import { toast } from "sonner";
import {motion} from "framer-motion"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import { Check, ChevronDown, Loader2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import useFlightStore from "@/stores/useFlightStore";
import { cn } from "@/lib/utils";
import { FlightTicketTypes } from "./constants";
import CalenderIcon from "@/assets/dashboard/calendar.svg"
import CustomButton from "@/components/CustomButton";
import BackButton from "@/components/Authentication/BackButton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FlightData, getFlightClasses, getFlightOffers, searchCities, TCity } from "@/lib/api/dashboard-apis/flightApis";
import { AxiosError } from "axios";
import Loader from "@/components/Loader";
import EmptyState from "../EmptyState";


const BookFlightForm = () => {
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);

  const [fromSearch, setFromSearch] = useState("");
  const [debouncedFromSearch, setDebouncedFromSearch] = useState("");

  const [toSearch, setToSearch] = useState("");
  const [debouncedToSearch, setDebouncedToSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFromSearch(fromSearch);
    }, 500);

    return () => clearTimeout(handler);
  }, [fromSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedToSearch(toSearch);
    }, 500);

    return () => clearTimeout(handler);
  }, [toSearch]);
  
  const {update, airlines, ticketType, fromLocation, toLocation, departureDate, arrivalDate, flightType, adult_count, children_count, infant_count, reset} = useFlightStore();
  
  const ONE_DAY = 24 * 60 * 60 * 1000
  const currentDate = new Date(Date.now() - ONE_DAY);

  const handleLocationSelect = (value: TCity, type: "from" | "to") => {
    if(type === "from"){
      if(value === toLocation){
        toast.info("You can't travel between the same location")
        return
      }
      update({ fromLocation: value})
    }

    if(type === "to"){
      if(value === fromLocation){
        toast.info("You can't travel between the same location")
        return
      }
      update({ toLocation: value})
    }
  }

  const arrivalInputRef = useRef<HTMLInputElement>(null);
  const departureInputRef = useRef<HTMLInputElement>(null);

  const handleOpenPicker = (inputRef: React.RefObject<HTMLInputElement | null>) => {
    if (inputRef.current) {
      inputRef.current.showPicker(); // programmatically open the date picker
    }
  };

  const handleDatePicker = (value: Date, type: "departure" | "arrival") => {
    if(value < currentDate ){
      toast.info("You can't select a day in the past");
      return
    }
    
    if(type === "departure"){
      if(arrivalDate && (arrivalDate) < value ){
        toast.info("Your departure date cannot be after your arrival date!");
        return
      }

      update({ departureDate: value})
    }

    if(type === "arrival"){
      if(departureDate && departureDate > value ){
        toast.info("Your arrival date cannot be before your departure date!");
        return
      }

      update({ arrivalDate: value})
    }
  }

  const { data: flightClasses, isLoading: loadingClasses } = useQuery<string[], Error>({
    queryKey: ["flight-classes"],
    queryFn: getFlightClasses,
  });

  const { data: fromCities = [], isLoading: loadingFromCities, isSuccess: isFromCitiesSuccess} = useQuery<TCity[], Error>({
    queryKey: ["cities-from", debouncedFromSearch],
    queryFn: () => searchCities(debouncedFromSearch),
    enabled: debouncedFromSearch.length > 2
  });

  const { data: toCities = [], isLoading: loadingToCities, isSuccess: isToCitiesSuccess } = useQuery<TCity[], Error>({
    queryKey: ["cities-to", debouncedToSearch],
    queryFn: () => searchCities(debouncedToSearch),
    enabled: debouncedToSearch.length > 2
  });

  const {mutate, isPending} = useMutation({
      mutationFn: getFlightOffers,
      onSuccess: (data) => {
        if(data.data.length === 0) toast.error("No flight offers found for the selected criteria");
        update({ airlines: data.data as FlightData[], selectedAirline: null });
      },
      onError: (error: AxiosError) => {
        (void 0)
          const errData = error.response?.data as { message?: string };
          if(errData.message){
              return toast.error(errData.message)
          }
          toast.error("Something went wrong, please try again")
      }
  })

  const handleFlightBooking = useCallback(() => {
    if(!fromLocation || !toLocation || !departureDate || !flightType || !adult_count){
      toast.error("Please fill all the required fields")
      return
    }
    const departure_date = departureDate?.toISOString().split('T')[0];
    mutate({trip_type: ticketType, departure_date, from: fromLocation.code, to: toLocation.code, flight_class: flightType, adult_count, children_count, infant_count, return_date: ticketType === "round_trip" ? arrivalDate?.toISOString().split('T')[0] : undefined})
  }, [ ticketType, fromLocation, toLocation, departureDate, arrivalDate, flightType, adult_count, children_count, infant_count, mutate]);

  const isRoundTrip = ticketType === "round_trip";
  const allFieldsFilled =
    ticketType &&
    fromLocation &&
    toLocation &&
    departureDate &&
    flightType &&
    adult_count &&
    children_count &&
    infant_count &&
    (!isRoundTrip || arrivalDate);

    useEffect(() => {reset()}, [reset])

  return (
    <>
      <section className={cn("w-full", airlines.length && "max-md:hidden")}>
            <div className="flex items-center mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
              <BackButton icon href="/dashboard"/>
              <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Book flight</p>
            </div>

            <div className="max-md:hidden">
              <BackButton href="/dashboard" className="mb-8" />
              <h1 className="text-[#112929] text-2xl font-medium">Book flight</h1>
              <p className="text-[#717171] mt-2">Please select the flight you want to book</p>
            </div>
            
            <div className="mt-16 md:mt-5 flex flex-col gap-5">
                    {/* Ticket Type */}
                  <div className="">
                    <h3 className="text-[#344054] text-sm font-medium mb-1.5">Ticket type</h3>
                    <div className="flex items-center gap-3">
                        {
                            FlightTicketTypes.map(({id, label, value}) => {
                                const isSelected = ticketType === value;
                                return (
                                  <button 
                                      key={id} 
                                      onClick={() => update({ticketType: value})} 
                                      type="button" 
                                      className={cn("relative w-full h-8 md:h-10 cursor-pointer border py-2 px-2.5 rounded-sm text-xs", isSelected ? "text-white" : "border-[#475467]/20 text-[#475467] bg-white" )}
                                  >
                                      <span className="z-[2] relative">{label}</span>
                                      {isSelected && <motion.span
                                          layoutId="selected"
                                          className="absolute z-[1] bg-[#464E60] text-white border-[#1A1A31] inset-0 rounded-sm"
                                          ></motion.span>}
                                  </button>

                                )
                            })
                        }
                    </div>
                  </div>

                  <div className="w-full">
                        <label className="text-sm text-[#344054] font-medium" htmlFor="account">From</label>
                        <Popover open={showFromDropdown} onOpenChange={setShowFromDropdown}>
                            <PopoverTrigger asChild>
                                <CustomButton
                                    aria-expanded={open}
                                    className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                                >
                                    {fromLocation
                                        ? <span className="text-[#344054] text-left line-clamp-1">{fromLocation.full_name} - {fromLocation.country.name}</span>
                                        : `${loadingFromCities ? "Loading cities..." : "Select Location"}`}
                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </CustomButton>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[90vw] md:w-[350px]">
                                <div className="flex flex-col gap-5">
                                  <input
                                    value={fromSearch}
                                    onChange={(e) => setFromSearch(e.target.value)}
                                    placeholder="Search..."
                                    className="w-full outline-0 bg-white px-4 py-2 border border-[#D0D5DD] shadow-[#1018280D] text-[#344054] text-sm rounded-md mt-1 focus:border-[#112929] disabled:pointer-events-none disabled:bg-[#F0F2F5] disabled:text-[#98A2B3] transition"
                                  />
                                  <div className="full">
                                    <Command className="">
                                        <CommandList className="px-3.5">
                                            {(loadingFromCities && !fromCities.length) && <CommandEmpty className="flex items-center gap-2 py-2"><Loader2 className="animate-spin size-4 text-[#344054]" /> <span className="text-sm">Loading cities...</span></CommandEmpty>}
                                            {(!loadingFromCities && !fromCities.length) && <CommandEmpty><EmptyState text={isFromCitiesSuccess ? "No city found, please input the correct city name" : "Type the name of the city you're traveling from"} /></CommandEmpty>}
                                            <CommandGroup className="px-0">
                                                {
                                                  fromCities?.map((city) => (
                                                      <CommandItem
                                                        className={cn("text-[#344054] justify-between", fromLocation && city === fromLocation && "font-medium")}
                                                        key={city.id}
                                                        value={city.code}
                                                        onSelect={() => {
                                                          handleLocationSelect(city, "from");
                                                          setShowFromDropdown(false);
                                                        }}
                                                      >
                                                        {city.name} - {city.country.name}
                                                        <Check
                                                          className={cn("mr-2 h-4 w-4", fromLocation === city ? "opacity-100" : "opacity-0")}
                                                        />
                                                      </CommandItem>
                                                    ))
                                                    }
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                  </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                  </div>

                  <div className="w-full">
                        <label className="text-sm text-[#344054] font-medium" htmlFor="account">To</label>
                        <Popover open={showToDropdown} onOpenChange={setShowToDropdown}>
                            <PopoverTrigger asChild>
                                <CustomButton
                                    aria-expanded={open}
                                    className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                                >
                                    {toLocation
                                        ? <span className="text-[#344054] text-left line-clamp-1">{toLocation.full_name} - {toLocation.country.name}</span>
                                        : `${loadingToCities ? "Loading cities..." : "Select Location"}`}
                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </CustomButton>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[90vw] md:w-[350px]">
                                <div className="flex flex-col gap-5">
                                  <input
                                    value={toSearch}
                                    onChange={(e) => setToSearch(e.target.value)}
                                    placeholder="Search..."
                                    className="w-full outline-0 bg-white px-4 py-2 border border-[#D0D5DD] shadow-[#1018280D] text-[#344054] text-sm rounded-md mt-1 focus:border-[#112929] disabled:pointer-events-none disabled:bg-[#F0F2F5] disabled:text-[#98A2B3] transition"
                                  />
                                  <div className="full">
                                    <Command className="">
                                        <CommandList className="px-3.5">
                                            {(loadingToCities && !toCities.length) && <CommandEmpty className="flex items-center gap-2 py-2"><Loader2 className="animate-spin size-4 text-[#344054]" /> <span className="text-sm">Loading cities...</span></CommandEmpty>}
                                            {(!loadingToCities && !toCities.length) && <CommandEmpty><EmptyState text={isToCitiesSuccess ? "No city found, please input the correct city name" : "Type the name of the city you're traveling to"} /></CommandEmpty>}
                                            <CommandGroup className="px-0">
                                                {
                                                  toCities?.map((city) => (
                                                    <CommandItem
                                                      className={cn("text-[#344054] justify-between", toLocation && city === toLocation && "font-medium")}
                                                      key={city.id}
                                                      value={city.code}
                                                      onSelect={() => {
                                                        handleLocationSelect(city, "to");
                                                        setShowToDropdown(false);
                                                      }}
                                                    >
                                                      {city.name} - {city.country.name}
                                                      <Check
                                                        className={cn("mr-2 h-4 w-4", toLocation === city ? "opacity-100" : "opacity-0")}
                                                      />
                                                    </CommandItem>
                                                  ))
                                                    }
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                  </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                  </div>

                  <div className="w-full flex flex-col">
                        <label className="text-sm text-[#344054] font-medium mb-1.5" htmlFor="departure-date">Departure date</label>
                        <div
                            onClick={() => handleOpenPicker(departureInputRef)}
                            className={cn(
                              "cursor-pointer w-full h-12 flex items-center px-3.5 justify-between text-sm font-normal border-[0.5px] border-[#D0D5DD] rounded-lg bg-white outline-none focus-within:border-[#112929]",
                              !departureDate && "text-[#667085]"
                            )}
                          >
                            <input
                              ref={departureInputRef}
                              type="date"
                              onKeyDown={(e) => e.preventDefault()} // Prevent typing
                              value={departureDate ? departureDate.toISOString().split('T')[0] : ''}
                              onChange={(e) => handleDatePicker(new Date(e.target.value),"departure")}
                              placeholder="Pick a date"
                              className="bg-transparent cursor-pointer  outline-none border-none flex-1 placeholder:text-[#667085] text-sm font-normal"
                            />
                            <img className="size-[22px] cursor-pointer" src={CalenderIcon} alt="Calendar Icon" />
                          </div>
                  </div>

                  {
                    ticketType === "round_trip" && <div className="w-full flex flex-col">
                        <label className="text-sm text-[#344054] font-medium mb-1.5" htmlFor="departure-date">Arrival date</label>
                          <div
                            onClick={() => handleOpenPicker(arrivalInputRef)}
                            className={cn(
                              "w-full h-12 cursor-pointer flex items-center px-3.5 justify-between text-sm font-normal border-[0.5px] border-[#D0D5DD] rounded-lg bg-white outline-none focus-within:border-[#112929]",
                              !arrivalDate && "text-[#667085]"
                            )}
                          >
                            <input
                              ref={arrivalInputRef}
                              type="date"
                              onKeyDown={(e) => e.preventDefault()} // Prevent typing
                              value={arrivalDate ? arrivalDate.toISOString().split('T')[0] : ''}
                              onChange={(e) => handleDatePicker(new Date(e.target.value),"arrival")}
                              placeholder="Pick a date"
                              className="bg-transparent cursor-pointer outline-none border-none flex-1 placeholder:text-[#667085] text-sm font-normal"
                            />
                            <img className="size-[22px] cursor-pointer" src={CalenderIcon} alt="Calendar Icon" />
                          </div>
                  </div>
                  }

                  <div className="w-full">
                        <label className="text-sm text-[#344054] font-medium" htmlFor="account">Flight type</label>
                        <Select value={flightType} onValueChange={(value) => update({flightType: value})}>
                            <SelectTrigger disabled={loadingClasses} className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-placeholder:text-[#667085]">
                                <SelectValue placeholder={`${loadingToCities ? "Loading classes..." : "Select flight type"}`} />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                <SelectGroup>
                                    {
                                      (flightClasses && flightClasses.length) && flightClasses.map((flightClass) => (
                                          <SelectItem className="capitalize" key={flightClass} value={flightClass}>{flightClass}</SelectItem>
                                        ))
                                    }
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                  </div>

                  <div className="w-full flex gap-3 items-center">
                    <div className="w-full">
                      <label className="text-sm text-[#344054] font-medium" htmlFor="account">Adult(s)</label>
                      <input value={adult_count} onChange={e => update({adult_count: e.target.value})} placeholder="1" className="w-full border-[0.5px] mt-1.5 border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="number" min={1} id="amount" />
                    </div>
                    <div className="w-full">
                      <label className="text-sm text-[#344054] font-medium" htmlFor="account">Children</label>
                      <input value={children_count} onChange={e => update({children_count: e.target.value})} placeholder="0" className="w-full border-[0.5px] mt-1.5 border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="number" id="amount" />
                    </div>
                    <div className="w-full">
                      <label className="text-sm text-[#344054] font-medium" htmlFor="account">Infant(s)</label>
                      <input value={infant_count} onChange={e => update({infant_count: e.target.value})} placeholder="0" className="w-full border-[0.5px] mt-1.5 border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="number" id="amount" />
                    </div>
                  </div>
            </div>

            <CustomButton disabled={!allFieldsFilled} onClick={handleFlightBooking} className="w-full mt-10">Get Flight offers</CustomButton>
      </section>
      {isPending && <Loader className="fixed top-0 w-screen h-screen left-0 bg-white/40 backdrop-blur-[3px] z-[1000]" />}
    </>
  )
}

export default BookFlightForm