import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

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

type TProvidersDropdown = {
    providersArr: {value: string, label:string}[];
}

const ProvidersDropdown = ({providersArr}: TProvidersDropdown) => {
    const [showDropdown, setShowDropdown] = useState(false);

    const {provider, update} = useESimStore()

  return (
    <div className="w-full">
        <label className="text-sm text-[#344054] font-medium" htmlFor="account">Select Provider</label>
        <Popover open={showDropdown} onOpenChange={setShowDropdown}>
            <PopoverTrigger asChild>
                <CustomButton
                    aria-expanded={open}
                    className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                >
                    {provider
                        ? <span className="text-[#344054]">{providersArr.find((prov) => prov.value === provider)?.label}</span>
                        : "Select provider"}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </CustomButton>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[90vw] md:w-[410px]">
                <Command className="">
                    <CommandInput className="" placeholder="search..." />
                    <CommandList className="w-full px-3.5">
                        <CommandEmpty>No prov found.</CommandEmpty>
                        <CommandGroup className="px-0">
                        {providersArr.map((prov) => (
                            <CommandItem
                                className={cn("text-[#344054] justify-between", provider && prov.value === provider && "font-medium")}
                                key={prov.value}
                                value={prov.value}
                                onSelect={(currentValue) => {
                                    update({provider: currentValue === provider ? "" : currentValue})
                                    setShowDropdown(false)
                                }}
                            >
                                {prov.label}
                                <Check
                                    className={cn(
                                    "mr-2 h-4 w-4",
                                    provider === prov.value ? "opacity-100" : "opacity-0"
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

export default ProvidersDropdown