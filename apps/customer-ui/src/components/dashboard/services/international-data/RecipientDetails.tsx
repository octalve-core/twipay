import { formatNgnMinorUnits } from "@/lib/money";
import CustomButton from "@/components/CustomButton"
import { IntDataRecipientDetailFormSchema } from "@/lib/zodSchemas/dashboard.schema"
import { zodResolver } from "@hookform/resolvers/zod"
import {useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import PhoneInput from "react-phone-input-2"
import { z } from "zod"

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

import BackButton from "@/components/Authentication/BackButton"
import { useNavigate } from "react-router-dom"
import { Check, ChevronDown, Loader2 } from "lucide-react"
import { cn, convertToLocalPhoneNumber } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import {fetchIntDataCountries, fetchIntDataProducts, fetchIntDataProviders } from "@/lib/api/dashboard-apis/servicesApis"
import { Wallet } from "../../main-page/BalanceCard"
import { getWallet } from "@/lib/api/dashboard-apis/walletApis"
import usePurchaseIntDataStore from "@/stores/usePurchaseIntDataStore"

export type VerifyPhoneNoPayload = {phone: string; network: string};
export type phoneNoVerificationResponse = {
    isValid: boolean;
};

export type TIntCountry = {
  iso2: string;
  name: string;
  flag: string;
  iso3: string;
  phoneCode: string;
  currencyCode: string;
  currencySymbol: string;
  callingCodes: string[];
};

export type DataProviderType = {
  operatorId: number;
  name: string;
  country: {
    isoName: string;
    name: string;
  };
  logoUrl: string;
  denominationType: string;
  
  hasDataBundles: boolean;
  
  pricing: {
    senderCurrency: {
      code: string;
      symbol: string;
    };
    destinationCurrency: {
      code: string;
      symbol: string;
    };
    minAmount: number | null;
    maxAmount: number | null;
    localMinAmount: number | null;
    localMaxAmount: number | null;
  };

  fixedAmounts: number[];
}

export interface Variation {
  variationCode: string;
  name: string;
  amount: string;
  fixedPrice: string;
}

export interface TDataProduct {
  serviceName: string;
  serviceId: string;
  convenienceFee: string;
  variations: Variation[];
}

type TFormData = z.infer<typeof IntDataRecipientDetailFormSchema>

const RecipientDetails = () => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [showProvidersDropdown, setShowProvidersDropdown] = useState(false);
    const [showProductsDropdown, setShowProductsDropdown] = useState(false);

    const [prodAmount, setProdAmount] = useState<number | undefined>();
    
    const [isFocused, setIsFocused] = useState(false);

    const {
        data: wallet,
        isLoading: fetchingWallet
    } = useQuery<Wallet, Error>({
        queryKey: ["wallet", "twipay-v1"],
        queryFn: getWallet,
    })

    const navigate = useNavigate()
    const {update, step, provider, country, product} = usePurchaseIntDataStore();
    
    const {
        formState: {errors},
        handleSubmit,
        control
    } =  useForm<TFormData>({
        resolver: zodResolver(IntDataRecipientDetailFormSchema)
    })

    // International countries
    const {
        data: countries,
        isLoading,
    } = useQuery<TIntCountry[], Error>({
        queryKey: ["int-countries"],
        queryFn: fetchIntDataCountries, 
    })
    
    const selectedCountry = countries?.find((ctry) => ctry === country);

    // International data providers
    const {
        data: IntAirtimeProviders,
        isLoading: fetchingProviders,
        isError: fetchProvidersError,
        } = useQuery<DataProviderType[], Error, DataProviderType[], [string, string]>({
        queryKey: ['international-data-providers', selectedCountry?.iso2 as string],
        queryFn: fetchIntDataProviders,
        enabled: !!selectedCountry
    });

    const selectedProvider = IntAirtimeProviders?.find((prov) => prov.operatorId.toString() === provider);

    // International Data products
    const {
        data: IntDataProducts,
        isLoading: fetchingProducts,
        isError: fetchProductsError,
        } = useQuery<TDataProduct, Error, TDataProduct, [string, string]>({
        queryKey: ['international-data-providers', selectedProvider?.operatorId.toString() as string],
        queryFn: fetchIntDataProducts,
        enabled: !!selectedProvider
    });

    const selectedProduct = IntDataProducts?.variations?.find((prod) => prod.variationCode === product?.variationCode);

    useEffect(() => {
        setProdAmount(selectedProduct?.amount ? parseInt(selectedProduct.amount) : undefined)
    }, [selectedProduct])

    const onSubmit = (data: TFormData) => {
        const localPhone = convertToLocalPhoneNumber(data.phone) 
        update({step: step+1, phone: localPhone, amount: prodAmount ? prodAmount.toString() : ""})   
    }

  return (
        <section className="w-full max-w-[410px] mx-auto">
            <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
                <BackButton icon action={() =>navigate(-1)}/>
                <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Buy International Data</p>
            </div>
            <div className="hidden md:block">  
                <BackButton className="mb-8" action={() => navigate(-1)} />
                <h1 className="font-medium text-2xl text-[#112929] mb-2">Recipient details</h1>
                <h2 className=" text-[#717171]">Please enter your recipient details for this purchase</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-14 md:mt-5">
                <div className="w-full">
                    <label className="text-sm text-[#344054] font-medium" htmlFor="account">Select Country</label>
                    <Popover open={showDropdown} onOpenChange={setShowDropdown}>
                        <PopoverTrigger asChild>
                            <CustomButton
                                disabled={isLoading}
                                aria-expanded={open}
                                className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                            >
                                {country
                                    ? <div className="text-[#344054] flex items-center gap-2">
                                        <img alt="" src={selectedCountry?.flag} className="size-5 object-cover" />
                                        <span>{selectedCountry?.name}</span>
                                    </div>
                                    : `${isLoading ? "Loading countries..." : "Select country"}`}
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </CustomButton>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[90vw] md:w-[361px]">
                            <Command className="">
                                <CommandInput className="" placeholder="search..." />
                                <CommandList className="w-full px-3.5">
                                    <CommandEmpty>No country found.</CommandEmpty>
                                    <CommandGroup className="px-0">
                                    {countries && countries.map((ctry) => (
                                        <CommandItem
                                            className={cn("text-[#344054] justify-between", provider && ctry.iso2 === country?.iso2 && "font-medium")}
                                            key={ctry.iso2}
                                            value={ctry.iso2}
                                            onSelect={(currentValue) => {
                                                const ctryDetail = countries.find((ctry) => ctry.iso2 === currentValue)
                                                update(ctryDetail === selectedCountry ? {country: null} : {country: ctryDetail})
                                                setShowDropdown(false)
                                            }}
                                        >
                                            <div className="text-[#344054] flex items-center gap-2">
                                                <img alt="" src={ctry.flag} className="size-5 object-cover" />
                                                <span
                                                >{ctry.name}</span>
                                            </div>
                                            <Check
                                                className={cn(
                                                "mr-2 h-4 w-4",
                                                country?.iso2 === ctry.iso2 ? "opacity-100" : "opacity-0"
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

                <div className="w-full mt-5">
                    <label className="text-sm text-[#344054] font-medium" htmlFor="package">Select provider</label>
                    <Popover open={showProvidersDropdown} onOpenChange={setShowProvidersDropdown}>
                        <PopoverTrigger asChild>
                            <CustomButton
                                disabled={!selectedCountry || fetchingProviders}
                                aria-expanded={open}
                                className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                            >
                                {selectedProvider
                                    ? <div className="text-[#344054] flex items-center gap-2">
                                        <img alt="" src={selectedProvider.logoUrl} className="size-5 object-cover" />
                                        <span className="text-left line-clamp-1">{selectedProvider.name}</span>
                                    </div>
                                    : `${fetchingProviders ? "Loading providers..." : "Select provider"}`}
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </CustomButton>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[90vw] md:w-[360px]">
                            <Command className="">
                                <CommandInput className="" placeholder="search..." />
                                <CommandList className="w-full px-3.5">
                                    <CommandEmpty>No provider found.</CommandEmpty>
                                    <CommandGroup className="px-0">
                                    {IntAirtimeProviders && IntAirtimeProviders.length && IntAirtimeProviders.map((prov) => (
                                        <CommandItem
                                            className={cn("text-[#344054] justify-between", selectedProvider && prov === selectedProvider && "font-medium")}
                                            key={prov.operatorId}
                                            value={prov.operatorId.toString()}
                                            onSelect={(currentValue) => {
                                                update(currentValue === selectedProvider?.operatorId.toString() ? {provider: ""} : {provider: currentValue})
    
                                                setShowProvidersDropdown(false)
                                            }}
                                        >
                                            <div className="text-[#344054] flex items-center gap-2">
                                                <img alt="" src={prov.logoUrl} className="size-5 object-cover" />
                                                <span>{prov.name}</span>
                                            </div>
                                            <Check
                                                className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedProvider?.operatorId === prov.operatorId ? "opacity-100" : "opacity-0"
                                                )}
                                        />
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    {fetchProvidersError && <p className="text-red-600 text-sm mt-1">Failed to fetch providers, please refresh.</p>}
                </div>

                <div className="w-full mt-5">
                    <label className="text-sm text-[#344054] font-medium" htmlFor="product">Select product</label>
                    <Popover open={showProductsDropdown} onOpenChange={setShowProductsDropdown}>
                        <PopoverTrigger asChild>
                            <CustomButton
                                disabled={!selectedProvider || fetchingProducts}
                                aria-expanded={open}
                                className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                            >
                                {selectedProduct
                                    ? <div className="text-[#344054] flex items-center gap-2">
                                        {/* <img alt="" src={selectedProduct} className="size-5 object-cover" /> */}
                                        <span className="text-left line-clamp-1">{selectedProduct.name}</span>
                                    </div>
                                    : `${fetchingProviders ? "Loading products..." : "Select product"}`}
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </CustomButton>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[90vw] md:w-[360px]">
                            <Command className="">
                                <CommandInput className="" placeholder="search..." />
                                <CommandList className="w-full px-3.5">
                                    <CommandEmpty>No product found.</CommandEmpty>
                                    <CommandGroup className="px-0">
                                    {IntDataProducts && IntDataProducts.variations.length && IntDataProducts.variations.map((prod) => (
                                        <CommandItem
                                            className={cn("text-[#344054] justify-between", selectedProduct && prod === selectedProduct && "font-medium")}
                                            key={prod.variationCode}
                                            value={prod.variationCode}
                                            onSelect={(currentValue) => {
                                                const productDetail = IntDataProducts.variations.find((prod) => prod.variationCode === currentValue)
                                                update(productDetail?.variationCode === selectedProduct?.variationCode ? {product: null} : {product: productDetail})
    
                                                setShowProductsDropdown(false)
                                            }}
                                        >
                                            <div className="text-[#344054] flex items-center gap-2">
                                                {/* <img alt="" src={prod.logo} className="size-5 object-cover" /> */}
                                                <span>{prod.name}</span>
                                            </div>
                                            <Check
                                                className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedProduct?.variationCode === prod.variationCode ? "opacity-100" : "opacity-0"
                                                )}
                                        />
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    {fetchProductsError && <p className="text-red-600 text-sm mt-1">Failed to fetch products, please refresh.</p>}
                </div>

                <div className="w-full mt-5">
                    <label className="text-[#344054] text-sm font-medium mb-2" htmlFor="lastname">Phone number</label>
                    <Controller
                        name="phone"
                        control={control}
                        render={({field}) => (
                            <PhoneInput
                                country={selectedCountry?.iso2.toLowerCase() || undefined}
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="phone number"
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => {
                                    setIsFocused(false)
                                    field.onBlur()}
                                }
                                inputProps={{
                                    name: "phone",
                                    // required: true,
                                }}
                                buttonStyle={{ 
                                    borderRadius: "8px 0 0 8px",
                                    border: isFocused ? ".5px solid #112929" : "1px solid #D0D5DD",
                                    background: "#FFFFFF",
                                }}
                                inputStyle={{
                                    width: "100%",
                                    outline: "0",
                                    background: "#FFFFFF",
                                    height: "44px",
                                    border: isFocused ? "1px solid #112929" : "1px solid #D0D5DD",
                                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04)",
                                    borderRadius: "8px",
                                    color: "#344054",
                                }}
                            />
                                        
                        )}
                    />
                    {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone.message}</p>}


                    {/* {
                        (!isVerifying && verifyErrData ) && <p className="text-red-600 text-sm mt-1">Please input a valid {provider.replace("-airtime", "")} number</p>
                    }
                    {isVerifying && <motion.div initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: .5}}} className="flex items-center gap-2"><Loader2 className="animate-spin size-4 mt-2" /> <span className="italic text-sm">Verifying phone number</span></motion.div>}
                    {
                        verifiedPhone?.isValid && <motion.div initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: .5}}} className="flex mt-1 items-center gap-2">
                            <div className="grid place-items-center size-6 rounded-full border-2 border-[#039855] bg-[#12B76A] text-white"><BsCheck2Circle className="size-2.5" /> </div>
                            <p className="text-sm font-medium">Verified</p>
                        </motion.div>
                    }
                     */}
                </div>

                <div className="w-full mt-5">
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-[#344054] font-medium" htmlFor="amount">Amount</label>
                        <p className="text-xs text-[#464E60] md:hidden flex items-center gap-1">Available balance :
                            <span className="font-bold">
                                {fetchingWallet ? <Loader2 className="animate-spin size-3" />
                                : wallet ? formatNgnMinorUnits(wallet.availableBalanceMinor) : "Unavailable"}
                            </span>
                        </p>
                    </div>
                    <div className="w-full h-fit relative mt-1.5">
                        <input disabled defaultValue={prodAmount} className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-14 bg-white outline-none focus:border-[#112929]" id="amount" />
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2">{selectedCountry?.currencySymbol ?? "#"}</span>
                    </div>
                </div>

                <CustomButton disabled={!country || !provider || !product} className="w-full mt-5">Proceed - <span className="opacity-60">Confirm Purchase</span></CustomButton>
            </form>
        </section>
  )
}

export default RecipientDetails