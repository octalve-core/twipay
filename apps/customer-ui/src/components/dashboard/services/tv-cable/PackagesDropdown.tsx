import { useEffect, useState } from "react";
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
import { TvProductType } from "./RecipientDetails";

type TPackagesDropdown = {
    packagesArr: TvProductType[] | undefined;
    isLoading: boolean;
    disable?: boolean;
    error: boolean;
}

const PackagesDropdown = ({packagesArr,isLoading, disable, error}: TPackagesDropdown) => {
    const [showDropdown, setShowDropdown] = useState(false);

    const {package: selectedPackage, update, provider} = useTVCableStore();

    useEffect(() => {
        update({ package: null });
    }, [provider, update]);

  return (
    <div className="w-full">
        <label className="text-sm text-[#344054] font-medium" htmlFor="package">Select package</label>
        <Popover open={showDropdown} onOpenChange={setShowDropdown}>
            <PopoverTrigger asChild>
                <CustomButton
                    disabled={disable || isLoading}
                    aria-expanded={open}
                    className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                >
                    {selectedPackage
                        ? <div className="text-[#344054] flex items-center gap-2">
                            <img src={selectedPackage?.logo} className="size-5 object-cover" />
                            <span>{selectedPackage?.name} - {selectedPackage.validity}</span>
                        </div>
                        : `${isLoading ? "Loading packages..." : "Select package"}`}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </CustomButton>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[90vw] md:w-[360px]">
                <Command className="">
                    <CommandInput className="" placeholder="search..." />
                    <CommandList className="w-full px-3.5">
                        <CommandEmpty>No pckg found.</CommandEmpty>
                        <CommandGroup className="px-0">
                        {packagesArr && packagesArr.length && packagesArr.map((pckg) => (
                            <CommandItem
                                className={cn("text-[#344054] justify-between", selectedPackage && pckg.code === selectedPackage.code && "font-medium")}
                                key={pckg.id}
                                value={pckg.code}
                                onSelect={(currentValue) => {
                                    const cablePackage = packagesArr.find((pkg) => pkg.code === currentValue)
                                    update(currentValue === selectedPackage?.code ? {package: null} : {package: cablePackage})

                                    setShowDropdown(false)
                                }}
                            >
                                <div className="text-[#344054] flex items-center gap-2">
                                    <img src={pckg.logo} className="size-5 object-cover" />
                                    <span>{pckg.name} - {pckg.validity}</span>
                                </div>
                                <Check
                                    className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedPackage?.code === pckg.code ? "opacity-100" : "opacity-0"
                                    )}
                            />
                            </CommandItem>
                        ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
        {error && <p className="text-red-500 text-sm mt-1">Failed to fetch packages, please refresh.</p>}
    </div>
  )
}

export default PackagesDropdown