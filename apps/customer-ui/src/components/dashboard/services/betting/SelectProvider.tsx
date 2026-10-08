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

import useBettingStore from "@/stores/useBettingStore";
import CustomButton from "@/components/CustomButton";
import BackButton from "@/components/Authentication/BackButton";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { fetchBettingProviders } from "@/lib/api/dashboard-apis/servicesApis";
import { useQuery } from "@tanstack/react-query";

export type BettingProvider = {
  id: string;
  name: string;
  code: string;
  logo: string;
  serviceTypeCode: string;
};

const SelectProvider = () => {
    const [showDropdown, setShowDropdown] = useState(false);

    const navigate = useNavigate()
    const {provider, update, step} = useBettingStore();

    const {
        data: providers,
        isLoading,
    } = useQuery<BettingProvider[], Error>({
        queryKey: ["betting-providers"],
        queryFn: fetchBettingProviders,
    })

    const selectedProvider =  providers?.find((prov) => prov.id === provider);

  return (
    <section className="w-full max-w-[360px] mx-auto">
        <div className="hidden md:block">
            <BackButton className="mb-8" action={() =>navigate(-1)} /> 
            <h1 className="font-medium text-2xl text-[#112929] ">Select bookie</h1>
            <h2 className=" text-[#717171]">Please select the bookie you are funding to</h2>
        </div>

        <div className="w-full mt-5">
            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="account">Betting Provider</label>
                <Popover open={showDropdown} onOpenChange={setShowDropdown}>
                    <PopoverTrigger asChild>
                        <CustomButton
                            disabled={isLoading}
                            aria-expanded={open}
                            className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                        >
                            {provider
                                ? <div className="text-[#344054] flex items-center gap-2">
                                    <img src={selectedProvider?.logo} className="size-5 object-cover" />
                                    <span>{selectedProvider?.name}</span>
                                </div>
                                : `${isLoading ? "Loading provider..." : "Select provider"}`}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </CustomButton>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[90vw] md:w-[360px]">
                        <Command className="">
                            <CommandInput className="" placeholder="search..." />
                            <CommandList className="w-full px-3.5">
                                <CommandEmpty>No providers found.</CommandEmpty>
                                <CommandGroup className="px-0">
                                {providers && providers.length && providers.map((prov) => (
                                    <CommandItem
                                        className={cn("text-[#344054] justify-between", provider && prov.code === provider && "font-medium")}
                                        key={prov.id}
                                        value={prov.id}
                                        onSelect={(currentValue) => {
                                            update({provider: currentValue === provider ? "" : currentValue})
                                            setShowDropdown(false)
                                        }}
                                    >
                                        <div className="text-[#344054] flex items-center gap-2">
                                            <img src={prov.logo} className="size-5 object-cover" />
                                            <span>{prov.name}</span>
                                        </div>
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            provider === prov.code ? "opacity-100" : "opacity-0"
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