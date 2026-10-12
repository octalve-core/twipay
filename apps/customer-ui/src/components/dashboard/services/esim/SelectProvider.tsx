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

import { Check, ChevronDown } from "lucide-react";

import BackButton from "@/components/Authentication/BackButton";
import CustomButton from "@/components/CustomButton";

import useESimStore from "@/stores/useESimStore";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const countryArr = [
    {
        value: "Niger",
        label: "Niger",
    },
    {
        value: "Mexico",
        label: "Mexico",
    },
    {
        value: "Norway",
        label: "Norway",
    },
    {
        value: "Nepal",
        label: "Nepal",
    },
]

const Selectcountry = () => {
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    
    const navigate = useNavigate();
    const {country, update, step} = useESimStore();

  return (
    <section className="w-full max-w-[360px] mx-auto">
        <BackButton className="mb-8" action={() =>navigate(-1)} />
        <h1 className="font-medium text-2xl text-[#112929] ">Select country</h1>
        <h2 className=" text-[#717171]">Please select the country you are buying from</h2>

        <div className="w-full mt-5">
            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="account">Select country</label>
                <Popover open={showCountryDropdown} onOpenChange={setShowCountryDropdown}>
                    <PopoverTrigger asChild>
                        <CustomButton
                            aria-expanded={open}
                            className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                        >
                            {country
                                ? <span className="text-[#344054]">{countryArr.find((ctry) => ctry.value === country)?.label}</span>
                                : "Select country"}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </CustomButton>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 md:w-[361px]">
                        <Command className="">
                            <CommandInput className="" placeholder="search..." />
                            <CommandList className="w-full px-3.5">
                                <CommandEmpty>No ctry found.</CommandEmpty>
                                <CommandGroup className="px-0">
                                {countryArr.map((ctry) => (
                                    <CommandItem
                                        className={cn("text-[#344054] justify-between", country && ctry.value === country && "font-medium")}
                                        key={ctry.value}
                                        value={ctry.value}
                                        onSelect={(currentValue) => {
                                            update({country: currentValue === country ? "" : currentValue})
                                            setShowCountryDropdown(false)
                                        }}
                                    >
                                        {ctry.label}
                                    <Check
                                        className={cn(
                                        "mr-2 h-4 w-4",
                                        country === ctry.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
            <CustomButton onClick={() => update({step: step+1})} disabled={!country} className="w-full mt-5">Proceed - <span className="opacity-60">Purchase details</span></CustomButton>
        </div>
    </section>
  )
}

export default Selectcountry