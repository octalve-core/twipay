import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Country } from "country-state-city";

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
  
import CustomButton from "../../../CustomButton";
import useESimStore from "@/stores/useESimStore";
import { cn } from "@/lib/utils";

const CountriesDropdown = () => {
    const [showDropdown, setShowDropdown] = useState(false);

    const countriesData = Country.getAllCountries();
    const {country, update} = useESimStore();

  return (
    <div className="w-full">
        <label className="text-sm text-[#344054] font-medium" htmlFor="account">Select country</label>
        <Popover open={showDropdown} onOpenChange={setShowDropdown}>
            <PopoverTrigger asChild>
                <CustomButton
                    aria-expanded={open}
                    className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                >
                    {country
                        ? <span className="text-[#344054]">{countriesData.find((ctry) => ctry.isoCode === country)?.name}</span>
                        : "Select country"}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </CustomButton>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[90vw] md:w-[410px]">
                <Command className="">
                    <CommandInput className="" placeholder="search..." />
                    <CommandList className="w-full px-3.5">
                        <CommandEmpty>No countries found.</CommandEmpty>
                        <CommandGroup className="px-0">
                        {countriesData.map((ctry) => (
                            <CommandItem
                                className={cn("text-[#344054] justify-between", country && ctry.isoCode === country && "font-medium")}
                                key={ctry.isoCode}
                                value={ctry.isoCode}
                                onSelect={(currentValue) => {
                                    update({country: currentValue === country ? "" : currentValue})
                                    setShowDropdown(false)
                                }}
                            >
                                {ctry.name}
                                <Check
                                    className={cn(
                                    "mr-2 h-4 w-4",
                                    country === ctry.isoCode ? "opacity-100" : "opacity-0"
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
  )
}

export default CountriesDropdown