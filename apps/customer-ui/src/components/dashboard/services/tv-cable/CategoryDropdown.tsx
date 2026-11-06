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
import { cn } from "@/lib/utils";
import useTVCableStore from "@/stores/useTVCableStore";
import { TvProviderType } from "./RecipientDetails";

type TCategoryDropdown = {
    categoriesArr: TvProviderType[] | undefined;
    isLoading: boolean;
    error: boolean;
}

const CategoryDropdown = ({categoriesArr, isLoading, error}: TCategoryDropdown) => {
    const [showDropdown, setShowDropdown] = useState(false);

    const {provider, update} = useTVCableStore();

  return (
    <div className="w-full">
        <label className="text-sm text-[#344054] font-medium" htmlFor="category">Select provider</label>
        <Popover open={showDropdown} onOpenChange={setShowDropdown}>
            <PopoverTrigger asChild>
                <CustomButton
                    disabled={isLoading}
                    aria-expanded={open}
                    className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                >
                    {provider
                        ? <div className="text-[#344054] flex items-center gap-2">
                            <img alt="" src={provider?.logo} className="size-5 object-cover" />
                            <span>{provider?.name}</span>
                        </div>
                        : `${isLoading ? "Loading provider..." : "Select provider"}`}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </CustomButton>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[90vw] md:w-[360px]">
                <Command className="">
                    <CommandInput className="" placeholder="search..." />
                    <CommandList className="w-full px-3.5">
                        <CommandEmpty>No provider found.</CommandEmpty>
                        <CommandGroup className="px-0">
                        {categoriesArr && categoriesArr.length && categoriesArr.map((prov) => (
                            <CommandItem
                                className={cn("text-[#344054] justify-between", provider && prov.code === provider.code && "font-medium")}
                                key={prov.id}
                                value={prov.code}
                                onSelect={(currentValue) => {
                                    const cableProvider = categoriesArr.find((prov) => prov.code === currentValue)
                                    update(currentValue === provider?.code ? {provider: null} : {provider: cableProvider})
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
                                    provider?.code === prov.code ? "opacity-100" : "opacity-0"
                                    )}
                            />
                            </CommandItem>
                        ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
        {error && <p className="text-red-600 text-sm mt-1">Failed to fetch providers, please refresh.</p>}
    </div>
  )
}

export default CategoryDropdown