import CustomButton from "@/components/CustomButton"

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

import useEpinStore from "@/stores/useEPinStore"
import BackButton from "@/components/Authentication/BackButton"
import { useNavigate } from "react-router-dom"
import { FormEvent, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { fetchEpinProviders, getEpinProducts } from "@/lib/api/dashboard-apis/servicesApis"
import { EpinProductType, EpinProviderType } from "./SelectProvider"
import {AnimatePresence, motion} from "framer-motion"

const RecipientDetails = () => {
    const [examNumber, setExamNumber] = useState("");
    const [prodAmount, setProdAmount] = useState<number | undefined>();

    const [showProvidersDropdown, setShowProvidersDropdown] = useState(false);
    const [showProductsDropdown, setShowProductsDropdown] = useState(false);

    const navigate = useNavigate()
    const {update, step, selectedProduct, selectedProvider} = useEpinStore();

    const {
        data: providers,
        isLoading: fetchingProviders,
        isError: fetchProvidersError
    } = useQuery<EpinProviderType[], Error>({
        queryKey: ["epin-providers"],
        queryFn: fetchEpinProviders,
    })

    const {
        data: EpinProducts,
        isLoading: fetchingProducts,
        isError: fetchProductsError,
        } = useQuery<EpinProductType[], Error, EpinProductType[], [string, number]>({
        queryKey: ['epin-products', selectedProvider?.id as number],
        queryFn: getEpinProducts,
        enabled: !!selectedProvider
    });

    useEffect(() => {
        setProdAmount(selectedProduct?.amount)
    }, [selectedProduct])

    useEffect(() => {
        update({ selectedProduct: null });
    }, [selectedProvider, update]);

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
    }

    (void 0)
    
  return (
    <section className="w-full max-w-[360px] mx-auto">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon action={() =>navigate(-1)}/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Buy EPIN</p>
        </div>

        <div className="hidden md:block">
            <BackButton className="mb-8" action={() => update({step: step-1})} /> 
            <h1 className="font-medium text-2xl text-[#112929] ">Recipient details</h1>
            <h2 className=" text-[#717171]">Please enter your recipient details for this purchase</h2>
        </div>

        <form onSubmit={onSubmit} className="mt-14 md:mt-5 flex flex-col gap-5">            
            <div className="w-full md:hidden">
                <label className="text-sm text-[#344054] font-medium" htmlFor="account">Select category</label>
                <Popover open={showProvidersDropdown} onOpenChange={setShowProvidersDropdown}>
                    <PopoverTrigger asChild>
                        <CustomButton
                            disabled={fetchingProviders}
                            aria-expanded={open}
                            className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                        >
                            {selectedProvider
                                ? <div className="text-[#344054] flex items-center gap-2">
                                        <img src={selectedProvider.logo} className="size-5 object-cover" />
                                        <span>{selectedProvider.name}</span>
                                    </div>
                                : `${fetchingProviders ? "Loading categories..." : "Select category"}`}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </CustomButton>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 md:w-[361px]">
                        <Command className="">
                            <CommandInput className="" placeholder="search..." />
                            <CommandList className="w-full px-3.5">
                                <CommandEmpty>No cat found.</CommandEmpty>
                                <CommandGroup className="px-0">
                                {providers && providers.length && providers.map((prov) => (
                                    <CommandItem
                                        className={cn("text-[#344054] justify-between", selectedProvider && prov === selectedProvider && "font-medium")}
                                        key={prov.id}
                                        value={prov.code}
                                        onSelect={(currentValue) => {
                                            const provider = providers.find((prv) => prv.code === currentValue)
                                            update(provider === selectedProvider ? {selectedProvider: null} : {selectedProvider: provider})
                                            setShowProvidersDropdown(false)
                                        }}
                                    >
                                    <div className="text-[#344054] flex items-center gap-2">
                                        <img src={prov.logo} className="size-5 object-cover" />
                                        <span>{prov.name}</span>
                                    </div>
                                    <Check
                                        className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedProvider === prov ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                {fetchProvidersError && <p className="text-red-500 text-sm mt-1">Failed to load categories, please refresh.</p>}
            </div>
            <div className="w-full md:hidden">
                <label className="text-sm text-[#344054] font-medium" htmlFor="package">Select product</label>
                <Popover open={showProductsDropdown} onOpenChange={setShowProductsDropdown}>
                    <PopoverTrigger asChild>
                        <CustomButton
                            disabled={!selectedProvider }
                            aria-expanded={open}
                            className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                        >
                            {selectedProduct
                                ? <div className="text-[#344054] flex items-center gap-2">
                                    <img src={selectedProduct.logo} className="size-5 object-cover" />
                                    <span className="text-left line-clamp-1">{selectedProduct.name}</span>
                                </div>
                                : `${fetchingProducts ? "Loading products..." : "Select product"}`}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </CustomButton>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[90vw] md:w-[360px]">
                        <Command className="">
                            <CommandInput className="" placeholder="search..." />
                            <CommandList className="w-full px-3.5">
                                <CommandEmpty>No pckg found.</CommandEmpty>
                                <CommandGroup className="px-0">
                                {EpinProducts && EpinProducts.length && EpinProducts.map((pckg) => (
                                    <CommandItem
                                        className={cn("text-[#344054] justify-between", selectedProduct && pckg === selectedProduct && "font-medium")}
                                        key={pckg.id}
                                        value={pckg.code}
                                        onSelect={(currentValue) => {
                                            const epinProduct = EpinProducts.find((pkg) => pkg.code === currentValue)
                                            update(currentValue === selectedProduct?.code ? {selectedProduct: null} : {selectedProduct: epinProduct})

                                            setShowProductsDropdown(false)
                                        }}
                                    >
                                        <div className="text-[#344054] flex items-center gap-2">
                                            <img src={pckg.logo} className="size-5 object-cover" />
                                            <span>{pckg.name}</span>
                                        </div>
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedProduct?.code === pckg.code ? "opacity-100" : "opacity-0"
                                            )}
                                    />
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                {fetchProductsError && <p className="text-red-500 text-sm mt-1">Failed to fetch products, please refresh.</p>}
            </div>

            <AnimatePresence>                
                {selectedProvider?.code === "utme" || selectedProduct?.code === "de" && (
                <motion.div
                    initial={{height:0}}
                    animate={{height: "auto"}}
                    exit={{height:0}}
                    className="w-full">
                    <label className="text-sm text-[#344054] font-medium" htmlFor="user">Exam number</label>
                    <input value={examNumber} onChange={(e) => setExamNumber(e.target.value)} placeholder="Enter exam number" className="w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="text" id="examNumber" />
                </motion.div>)}
            </AnimatePresence>

            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="amount">Amount</label>
                <div className="w-full h-fit relative mt-1.5">
                    <input disabled defaultValue={prodAmount} className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929]" id="amount" />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2">₦</span>
                </div>
            </div>

            <CustomButton disabled={!selectedProvider || !selectedProduct} className="w-full">Proceed - <span className="opacity-60">Confirm Purchase</span></CustomButton>
        </form>
    </section>
  )
}

export default RecipientDetails