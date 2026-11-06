import BackButton from "@/components/Authentication/BackButton";
import CustomButton from "@/components/CustomButton";

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
import useElectricityBillsStore from "@/stores/useElectricityBillsStore";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

import { fetchElectricityProviders } from "@/lib/api/dashboard-apis/servicesApis";
import { useQuery } from "@tanstack/react-query";

export type ElectricityProvider = {
  id: string;
  name: string;
  code: string;
  logo: string;
  serviceTypeCode: string;
};

const SelectProvider = () => {
    const [showDropdown, setShowDropdown] = useState(false);
    
    const navigate = useNavigate();
    const {provider, update, step} = useElectricityBillsStore();
    
    const {
        data: providers,
        isLoading,
    } = useQuery<ElectricityProvider[], Error>({
        queryKey: ["electricity-providers"],
        queryFn: fetchElectricityProviders,
    })

    const selectedProvider =  useMemo(() => providers?.find((prov) => prov.id === provider), [provider, providers])
    
  return (
    <section className="w-full max-w-[361px] mx-auto">
        <div className="flex items-center mb-10 mt-2 md:hidden">
            <BackButton icon action={() =>navigate(-1)}/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Buy Data</p>
        </div>

        <div className="hidden md:block">
            <BackButton className="mb-8" action={() =>navigate(-1)} /> 
            <h1 className="font-medium text-2xl text-[#112929] ">Distribution Company</h1>
            <h2 className=" text-[#717171]">Please select the provider you are buying from</h2>
        </div>

        <div className="w-full mt-5">
            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="account">Distribution company</label>
                <Popover open={showDropdown} onOpenChange={setShowDropdown}>
                    <PopoverTrigger asChild>
                        <CustomButton
                            disabled={isLoading}
                            aria-expanded={open}
                            className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                        >
                            {provider
                                ? <div className="text-[#344054] flex items-center gap-2">
                                        <img alt="" src={selectedProvider?.logo} className="size-5 object-cover" />
                                        <span>{selectedProvider?.name}</span>
                                    </div>
                                : `${isLoading ? "Loading electricity providers..." : "Select Electricity provider"}`}

                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </CustomButton>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 md:w-[361px]">
                        <Command className="">
                            <CommandInput className="" placeholder="search..." />
                            <CommandList className="w-full px-3.5">
                                <CommandEmpty>No providers found.</CommandEmpty>
                                <CommandGroup className="px-0">
                                {providers?.map((prov) => (
                                    <CommandItem
                                        className={cn("text-[#344054] justify-between", provider && prov.id === provider && "font-medium")}
                                        key={prov.id}
                                        value={prov.id}
                                        onSelect={(currentValue) => {
                                            update({provider: currentValue === provider ? "" : currentValue})
                                            setShowDropdown(false)
                                        }}
                                    >
                                        <div className="text-[#344054] flex items-center gap-2">
                                            <img alt="" src={prov.logo} className="size-5 object-cover" />
                                            <span>{prov.name}</span>
                                        </div>
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            provider === prov.id ? "opacity-100" : "opacity-0"
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
            <CustomButton onClick={() => update({step: step+1})} disabled={!provider || isLoading} className="w-full mt-5">Proceed - <span className="opacity-60">Enter details</span></CustomButton>
        </div>
    </section>
  )
}

export default SelectProvider