import BackButton from "@/components/Authentication/BackButton";
import { useRef, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import CustomButton from "@/components/CustomButton";
import { useQuery } from "@tanstack/react-query";
import { ICountry, IState } from "@/routes/auth-pages/UserDetails";
import { fetchCountries } from "@/lib/api/authApi";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api/axios";
import { toast } from "sonner";

import CalenderIcon from "@/assets/dashboard/calendar.svg"
import useFlightStore from "@/stores/useFlightStore";
import { useNavigate } from "react-router-dom";

type TDocumentInfo = {
    setShowDocumentForm: React.Dispatch<React.SetStateAction<boolean>>;
}

type TDocumentInfoData = {
    passportNo: string;
    nationality: ICountry | null;
    birth_place: IState | null;
    issuance_date: Date | null;
    expiry_date: Date | null;
    issuance_country: ICountry | null;
    issuance_state: IState | null;
    validity_country: ICountry | null;
}

// const ONE_DAY = 24 * 60 * 60 * 1000
const currentDate = new Date(Date.now());

const DocumentInfo = ({setShowDocumentForm}: TDocumentInfo) => {
    const [openPopover, setOpenPopover] = useState<"nationality" | "birth_place" | "issuance_country" | "issuance_state" | "validity_country" | null>(null);

    const [documentInfo, setDocumentInfo] = useState<TDocumentInfoData>({
        passportNo: "",
        nationality: null,
        birth_place: null,
        issuance_date: null,
        expiry_date: null,
        issuance_country: null,
        issuance_state: null,
        validity_country: null
    })

    const navigate = useNavigate();
    const {updatePassenger, setCurrentStep, currentStep, selectedAirline} = useFlightStore();
    const passengers = selectedAirline?.passengers || [];
    
    const issuanceDateRef = useRef<HTMLInputElement>(null);
    const expiryDateRef = useRef<HTMLInputElement>(null);

    const {
        data: countries,
        isLoading: fetchingCountries,
        error: countriesError
    } = useQuery<ICountry[], Error>({
        queryKey: ["countries"],
        queryFn: fetchCountries,
    })

    const fetchStates = async (id: number) => {
        const res = await api.get(
            `/states?do_not_paginate=1&country_id=${id}`
        )
        return res.data.data;
    }

    const {
        data: pobStates,
        isLoading: fetchingPobStates,
        error: pobStatesError
    } = useQuery<IState[], Error>({
        queryKey: ["pob-states", documentInfo.nationality?.id],
        queryFn: () => fetchStates(documentInfo.nationality?.id as number),
        enabled: !!documentInfo.nationality?.id
    })
    
    const {
        data: soiStates,
        isLoading: fetchingSoiStates,
        error: soiStatesError
    } = useQuery<IState[], Error>({
        queryKey: ["states", documentInfo.issuance_country?.id],
        queryFn: () => fetchStates(documentInfo.issuance_country?.id as number),
        enabled: !!documentInfo.issuance_country?.id
    })

     const handleOpenPicker = (inputRef: React.RefObject<HTMLInputElement | null>) => {
      if (inputRef.current) {
        inputRef.current.showPicker(); // programmatically open the date picker
      }
    };
    const handleIssuanaceDatePicker = (value: Date) => {
        if(value  > currentDate ){
            toast.info("You can't select a day in the future");
            return
        }

        setDocumentInfo(prev => ({...prev, issuance_date: value}))
    }

    const handleProceed = () => {
        const isDocumentInfoComplete = Object.values(documentInfo).every(value => {
            return (value !== null && value !== "")
        })

        if(!isDocumentInfoComplete){
            return toast.info("Please fill all fields")
        }

        updatePassenger(currentStep, {
            documents: {
                nationality: documentInfo.nationality?.iso2 as string,
                birth_place: documentInfo.birth_place?.name as string,
                expiry_date: documentInfo.expiry_date?.toISOString().split("T")[0] as string,
                is_holder: true,
                issuance_country: documentInfo.issuance_country?.iso2 as string,
                issuance_date: documentInfo.issuance_date?.toISOString().split("T")[0] as string,
                issuance_state: documentInfo.issuance_state?.name as string,
                number: documentInfo.passportNo as string,
                type: "passport",
                validity_country: documentInfo.validity_country?.iso2 as string
            }
        });

        setShowDocumentForm(false);
        if(currentStep < passengers.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        navigate(`/dashboard/flight/${selectedAirline?.id}/confirm`)
      }
    }

  return (
    <div className="flex max-md:flex-col md:items-start md:gap-[18px] w-full">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon action={() => setShowDocumentForm(false)}/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Document info</p>
        </div>

        <p className="text-[#344054] text-center md:hidden mt-14">Kindly enter your passport information</p>

        <BackButton className="max-md:hidden" action={() => setShowDocumentForm(false)} />
        <div className="flex max-md:flex-col gap-5 md:gap-[100px] w-full">
            <div className="w-full">
                <h1 className="text-[#112929] text-2xl font-medium max-md:hidden">Document info</h1>
                <p className="mt-2 text-[#717171] max-md:hidden">Please enter your passport information</p>

                <div className="mt-8 flex flex-col gap-5">
                    <div className="w-full ">
                        <label className="text-[#344054] text-sm font-medium" htmlFor="passportNo">Passport number</label>
                        <input value={documentInfo.passportNo} onChange={(e) => setDocumentInfo(prev => ({...prev, passportNo: e.target
                            .value
                        }))} id="passportNo" placeholder="enter your passport number" className="w-full outline-0 bg-white py-3 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-sm placeholder:text-[#667085] rounded-lg mt-1.5 focus:border-[#112929] transition" />
                    </div>

                    {/* Nationality select */}
                    <div className="w-full">
                        <label className="text-[#344054] text-sm font-medium" htmlFor="country">Nationality</label>
                        <Popover 
                            open={openPopover === "nationality"}
                            onOpenChange={(isOpen) => setOpenPopover(isOpen ? "nationality" : null) }
                        >
                            <PopoverTrigger asChild>
                                <CustomButton
                                    disabled={fetchingCountries}
                                    aria-expanded={open}
                                    className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                                >
                                    {documentInfo.nationality
                                        ? <div className="text-[#344054] flex items-center gap-2">
                                            <img src={documentInfo.nationality.flag} className="size-5 rounded-full object-cover" />
                                            <span>{documentInfo.nationality?.name}</span>
                                        </div>
                                        : `${fetchingCountries ? "Loading countries..." : "Select nationality"}`}
                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </CustomButton>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[90vw] md:w-[410px]">
                                <Command className="">
                                    <CommandInput className="" placeholder="search..." />
                                    <CommandList className="w-full px-3.5">
                                        <CommandEmpty>No country found.</CommandEmpty>
                                        <CommandGroup className="px-0">
                                        {countries && countries.length && countries.map((ctry) => (
                                            <CommandItem
                                                className={cn("text-[#344054] justify-between", documentInfo.nationality && ctry.name === documentInfo.nationality.name && "font-medium")}
                                                key={ctry.id}
                                                value={ctry.name}
                                                onSelect={(currentValue) => {
                                                    setDocumentInfo((prev) => {
                                                        const newCountry = prev.nationality?.name === currentValue ? null : ctry;
                                                        return {...prev, birth_place: null, nationality: newCountry}
                                                    })
                                                    setOpenPopover(null)
                                                }}
                                            >
                                                <div className="text-[#344054] flex items-center gap-2">
                                                    <img src={ctry.flag} className="size-5 rounded-full bg-gray-100 object-cover" />
                                                    <span>{ctry.name}</span>
                                                </div>
                                                <Check
                                                    className={cn(
                                                    "mr-2 h-4 w-4",
                                                        documentInfo.nationality?.name === ctry.name ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                            </CommandItem>
                                        ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {(countriesError && !countries?.length) && <p className="text-red-500 mt-1 text-sm">Failed to load countries. Please refresh.</p>}
                    </div>
                    {/* Place of birth */}
                    <div className="w-full">
                        <label className="text-[#344054] text-sm font-medium" htmlFor="state">Place of birth</label>
                        <Popover
                            open={openPopover === "birth_place"}
                            onOpenChange={(isOpen) => setOpenPopover(isOpen ? "birth_place" : null) }
                        >
                            <PopoverTrigger asChild>
                                <CustomButton
                                    disabled={fetchingPobStates || !documentInfo.nationality}
                                    aria-expanded={open}
                                    className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                                >
                                    {documentInfo.birth_place
                                        ? <span className="text-[#344054]">{documentInfo.birth_place.name}</span>
                                        : `${fetchingPobStates ? "Loading states..." : "Select place of birth"}`}
                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </CustomButton>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[90vw] md:w-[410px]">
                                <Command className="">
                                    <CommandInput className="" placeholder="search..." />
                                    <CommandList className="w-full px-3.5">
                                        <CommandEmpty>No states found.</CommandEmpty>
                                        <CommandGroup className="px-0">
                                        {pobStates && pobStates.map((st) => (
                                            <CommandItem
                                                className={cn("text-[#344054] justify-between", documentInfo.birth_place && st === documentInfo.birth_place && "font-medium")}
                                                key={st.id}
                                                value={st.name}
                                                onSelect={() => {
                                                    setDocumentInfo((prev) => {
                                                        const newPob = prev.birth_place === st ? null : st 
                                                        return {...prev, birth_place: newPob}
                                                    })
                                                    setOpenPopover(null)
                                                }}
                                            >
                                                {st.name}
                                            <Check
                                                className={cn(
                                                "mr-2 h-4 w-4",
                                                    documentInfo.birth_place === st ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            </CommandItem>
                                        ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {(pobStatesError && !pobStates?.length) && <p className="text-red-500 mt-1 text-sm">Failed to load states. Please refresh.</p>}
                    </div>
                    {/* Date of issuance */}
                    <div className="w-full flex flex-col ">
                        <label className="text-sm text-[#344054] font-medium mb-1.5" htmlFor="departure-date">Date of issue</label>
                        <div
                            onClick={() => handleOpenPicker(issuanceDateRef)}
                            className={cn(
                                "w-full h-12 cursor-pointer flex items-center px-3.5 justify-between text-sm font-normal border-[0.5px] border-[#D0D5DD] rounded-lg bg-white outline-none focus-within:border-[#112929]",
                                !documentInfo.issuance_date && "text-[#667085]"
                            )}
                        >
                        <input
                            ref={issuanceDateRef}
                            type="date"
                            onKeyDown={(e) => e.preventDefault()} // Prevent typing
                            value={documentInfo.issuance_date ? documentInfo.issuance_date.toISOString().split('T')[0] : ''}
                            onChange={(e) => handleIssuanaceDatePicker(new Date(e.target.value))}
                            placeholder="Pick a date"
                            className="bg-transparent cursor-pointer outline-none border-none flex-1 placeholder:text-[#667085] text-sm font-normal"
                        />
                            <img className="size-[22px] cursor-pointer" src={CalenderIcon} alt="Calendar Icon" />
                        </div>
                    </div>
                    {/* Date of expiry */}
                    <div className="w-full flex flex-col ">
                        <label className="text-sm text-[#344054] font-medium mb-1.5" htmlFor="departure-date">Date of expiry</label>
                        <div
                            onClick={() => handleOpenPicker(expiryDateRef)}
                            className={cn(
                                "w-full h-12 cursor-pointer flex items-center px-3.5 justify-between text-sm font-normal border-[0.5px] border-[#D0D5DD] rounded-lg bg-white outline-none focus-within:border-[#112929]",
                                !documentInfo.expiry_date && "text-[#667085]"
                            )}
                        >
                        <input
                            ref={expiryDateRef}
                            type="date"
                            onKeyDown={(e) => e.preventDefault()} // Prevent typing
                            value={documentInfo.expiry_date ? documentInfo.expiry_date.toISOString().split('T')[0] : ''}
                            onChange={(e) => setDocumentInfo(prev => ({...prev, expiry_date: new Date(e.target.value)}))}
                            placeholder="Pick a date"
                            className="bg-transparent cursor-pointer outline-none border-none flex-1 placeholder:text-[#667085] text-sm font-normal"
                        />
                            <img onClick={() => handleOpenPicker(expiryDateRef)} className="size-[22px] cursor-pointer" src={CalenderIcon} alt="Calendar Icon" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-[80vh] w-[1px] self-start bg-[#6670854D] sticky top-0 hidden md:block" />

            <div className="w-full">
                <h1 className="text-[#112929] text-2xl font-medium max-md:hidden">Document info</h1>
                <p className="mt-2 text-[#717171] max-md:hidden">Please enter your passport information</p>

                <div className="flex flex-col gap-5 md:mt-8">
                    {/* Issuance country */}
                    <div className="w-full">
                        <label className="text-[#344054] text-sm font-medium" htmlFor="country">Country of issuance</label>
                        <Popover
                            open={openPopover === "issuance_country"}
                            onOpenChange={(isOpen) => setOpenPopover(isOpen ? "issuance_country" : null) }
                        >
                            <PopoverTrigger asChild>
                                <CustomButton
                                    disabled={fetchingCountries}
                                    aria-expanded={open}
                                    className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                                >
                                    {documentInfo.issuance_country
                                        ? <div className="text-[#344054] flex items-center gap-2">
                                            <img src={documentInfo.issuance_country.flag} className="size-5 rounded-full object-cover" />
                                            <span>{documentInfo.issuance_country?.name}</span>
                                        </div>
                                        : `${fetchingCountries ? "Loading countries..." : "Select issuance country"}`}
                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </CustomButton>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[90vw] md:w-[410px]">
                                <Command className="">
                                    <CommandInput className="" placeholder="search..." />
                                    <CommandList className="w-full px-3.5">
                                        <CommandEmpty>No country found.</CommandEmpty>
                                        <CommandGroup className="px-0">
                                        {countries && countries.length && countries.map((ctry) => (
                                            <CommandItem
                                                className={cn("text-[#344054] justify-between", documentInfo.issuance_country && ctry.name === documentInfo.issuance_country.name && "font-medium")}
                                                key={ctry.id}
                                                value={ctry.name}
                                                onSelect={(currentValue) => {
                                                    setDocumentInfo((prev) => {
                                                        const newCountry = prev.issuance_country?.name === currentValue ? null : ctry;
                                                        return {...prev, issuance_state: null, issuance_country: newCountry}
                                                    })
                                                    setOpenPopover(null)
                                                }}
                                            >
                                                <div className="text-[#344054] flex items-center gap-2">
                                                    <img src={ctry.flag} className="size-5 rounded-full bg-gray-100 object-cover" />
                                                    <span>{ctry.name}</span>
                                                </div>
                                                <Check
                                                    className={cn(
                                                    "mr-2 h-4 w-4",
                                                        documentInfo.issuance_country?.name === ctry.name ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                            </CommandItem>
                                        ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {(countriesError && !countries?.length) && <p className="text-red-500 mt-1 text-sm">Failed to load countries. Please refresh.</p>}
                    </div>
                    {/* Issuance state */}
                    <div className="w-full">
                        <label className="text-[#344054] text-sm font-medium" htmlFor="state">State of issuance</label>
                        <Popover
                            open={openPopover === "issuance_state"}
                            onOpenChange={(isOpen) => setOpenPopover(isOpen ? "issuance_state" : null) }
                        >
                            <PopoverTrigger asChild>
                                <CustomButton
                                    disabled={fetchingSoiStates || !documentInfo.nationality}
                                    aria-expanded={open}
                                    className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                                >
                                    {documentInfo.issuance_state
                                        ? <span className="text-[#344054]">{documentInfo.issuance_state.name}</span>
                                        : `${fetchingSoiStates ? "Loading states..." : "Select Issuance state"}`}
                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </CustomButton>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[90vw] md:w-[410px]">
                                <Command className="">
                                    <CommandInput className="" placeholder="search..." />
                                    <CommandList className="w-full px-3.5">
                                        <CommandEmpty>No states found.</CommandEmpty>
                                        <CommandGroup className="px-0">
                                        {soiStates && soiStates.map((st) => (
                                            <CommandItem
                                                className={cn("text-[#344054] justify-between", documentInfo.issuance_state && st === documentInfo.issuance_state && "font-medium")}
                                                key={st.id}
                                                value={st.name}
                                                onSelect={() => {
                                                    setDocumentInfo((prev) => {
                                                        const newPob = prev.issuance_state === st ? null : st 
                                                        return {...prev, issuance_state: newPob}
                                                    })
                                                    setOpenPopover(null)
                                                }}
                                            >
                                                {st.name}
                                            <Check
                                                className={cn(
                                                "mr-2 h-4 w-4",
                                                    documentInfo.issuance_state === st ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            </CommandItem>
                                        ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {(soiStatesError && !soiStates?.length) && <p className="text-red-500 mt-1 text-sm">Failed to load states. Please refresh.</p>}
                    </div>
                    {/* Validity country */}
                    <div className="w-full">
                        <label className="text-[#344054] text-sm font-medium" htmlFor="country">Validity country</label>
                        <Popover
                            open={openPopover === "validity_country"}
                            onOpenChange={(isOpen) => setOpenPopover(isOpen ? "validity_country" : null) }
                        >
                            <PopoverTrigger asChild>
                                <CustomButton
                                    disabled={fetchingCountries}
                                    aria-expanded={open}
                                    className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                                >
                                    {documentInfo.validity_country
                                        ? <div className="text-[#344054] flex items-center gap-2">
                                            <img src={documentInfo.validity_country.flag} className="size-5 rounded-full object-cover" />
                                            <span>{documentInfo.validity_country?.name}</span>
                                        </div>
                                        : `${fetchingCountries ? "Loading countries..." : "Select validity country"}`}
                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </CustomButton>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[90vw] md:w-[410px]">
                                <Command className="">
                                    <CommandInput className="" placeholder="search..." />
                                    <CommandList className="w-full px-3.5">
                                        <CommandEmpty>No country found.</CommandEmpty>
                                        <CommandGroup className="px-0">
                                        {countries && countries.length && countries.map((ctry) => (
                                            <CommandItem
                                                className={cn("text-[#344054] justify-between", documentInfo.validity_country && ctry.name === documentInfo.validity_country.name && "font-medium")}
                                                key={ctry.id}
                                                value={ctry.name}
                                                onSelect={(currentValue) => {
                                                    setDocumentInfo((prev) => {
                                                        const newCountry = prev.validity_country?.name === currentValue ? null : ctry;
                                                        return {...prev, validity_country: newCountry}
                                                    })
                                                    setOpenPopover(null)
                                                }}
                                            >
                                                <div className="text-[#344054] flex items-center gap-2">
                                                    <img src={ctry.flag} className="size-5 rounded-full bg-gray-100 object-cover" />
                                                    <span>{ctry.name}</span>
                                                </div>
                                                <Check
                                                    className={cn(
                                                    "mr-2 h-4 w-4",
                                                        documentInfo.validity_country?.name === ctry.name ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                            </CommandItem>
                                        ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {(countriesError && !countries?.length) && <p className="text-red-500 mt-1 text-sm">Failed to load countries. Please refresh.</p>}
                    </div>

                    <CustomButton onClick={handleProceed} className="w-full mt-8">Proceed</CustomButton>
                </div>
            </div>
        </div>
    </div>
  )
}

export default DocumentInfo;