import { formatNgnMinorUnits } from "@/lib/money";
import CustomButton from "@/components/CustomButton"
import { AirtimeRecipientDetailFormSchema } from "@/lib/zodSchemas/dashboard.schema"
import usePurchaseAirtimeStore from "@/stores/usePurchaseAirtimeStore"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
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
import { useMutation, useQuery } from "@tanstack/react-query"
import { TAirtimeServiceProvider } from "./SelectProvider"
import { fetchAirtimeProviders, verifyPhoneNumber } from "@/lib/api/dashboard-apis/servicesApis"
import { AxiosError } from "axios"
import { BsCheck2Circle } from "react-icons/bs"
import {motion} from "framer-motion"
import { Wallet } from "../../main-page/BalanceCard"
import { getWallet } from "@/lib/api/dashboard-apis/walletApis"

export type VerifyPhoneNoPayload = {phone: string; network: string};
export type phoneNoVerificationResponse = {
    isValid: boolean;
};

type TFormData = z.infer<typeof AirtimeRecipientDetailFormSchema>

const RecipientDetails = () => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const {
        data: wallet,
        isLoading: fetchingWallet
    } = useQuery<Wallet, Error>({
        queryKey: ["wallet", "twipay-v1"],
        queryFn: getWallet,
    })

    const navigate = useNavigate()
    const {update, step, provider} = usePurchaseAirtimeStore();
    
    const {
        register,
        formState: {errors},
        handleSubmit,
        watch,
        control
    } =  useForm<TFormData>({
        resolver: zodResolver(AirtimeRecipientDetailFormSchema)
    })

    const {mutate, isPending: isVerifying, data: verifiedPhone, error: verifyError} = useMutation<phoneNoVerificationResponse, AxiosError, VerifyPhoneNoPayload>({
        mutationFn: verifyPhoneNumber,
        onSuccess: (data) => {
            void 0;
        },
        onError: (error: AxiosError) => {
            void 0;
        }
    })

    let verifyErrData: { message?: string } | undefined;
    if (verifyError?.response?.data) {
        verifyErrData = verifyError.response.data;
    }

    const {
        data: providers,
        isLoading,
    } = useQuery<TAirtimeServiceProvider[], Error>({
        queryKey: ["airtime-providers"],
        queryFn: fetchAirtimeProviders,
    })
    
    const selectedProvider = providers?.find((prov) => prov.code === provider);

    const onSubmit = (data: TFormData) => {
        const localPhone = convertToLocalPhoneNumber(data.phone) 
        update({step: step+1, phone: localPhone, amount: data.amount})   
    }

    const phoneNo = watch("phone");

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
        if(phoneNo && phoneNo.length >= 10 && provider){
            mutate({network: provider, phone: convertToLocalPhoneNumber(phoneNo)})
        }
    }, 1000);
    
        return () => clearTimeout(delayDebounce)
    }, [phoneNo, mutate, provider])

  return (
        <section className="w-full max-w-[410px] mx-auto">
            <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
                <BackButton icon action={() =>navigate(-1)}/>
                <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Buy Airtime</p>
            </div>
            <div className="hidden md:block">  
                <BackButton className="mb-8" action={() => update({step: step-1})} /> 
                <h1 className="font-medium text-2xl text-[#112929] mb-2">Recipient details</h1>
                <h2 className=" text-[#717171]">Please enter your recipient details for this purchase</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-14 md:mt-5">
                <div className="w-full md:hidden">
                    <label className="text-sm text-[#344054] font-medium" htmlFor="account">Network provider</label>
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
                                    : `${isLoading ? "Loading network providers..." : "Select network provider"}`}
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </CustomButton>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[90vw] md:w-[361px]">
                            <Command className="">
                                <CommandInput className="" placeholder="search..." />
                                <CommandList className="w-full px-3.5">
                                    <CommandEmpty>No provider found.</CommandEmpty>
                                    <CommandGroup className="px-0">
                                    {providers && providers.map((prov) => (
                                        <CommandItem
                                            className={cn("text-[#344054] justify-between", provider && prov.code === provider && "font-medium")}
                                            key={prov.id}
                                            value={prov.code}
                                            onSelect={(currentValue) => {
                                                update({provider: currentValue === provider ? "" : currentValue})
                                                setShowDropdown(false)
                                            }}
                                        >
                                            <div className="text-[#344054] flex items-center gap-2">
                                                <img alt="" src={prov.logo} className="size-5 object-cover" />
                                                <span
                                                    // style={{
                                                    //     textColor
                                                    // }}
                                                >{prov.name}</span>
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


                <div className="w-full mt-5">
                    <label className="text-[#344054] text-sm font-medium mb-2" htmlFor="lastname">Phone number</label>
                    <Controller
                        name="phone"
                        control={control}
                        render={({field}) => (
                            <PhoneInput
                                country={'ng'}
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
                    {
                        (!isVerifying && verifyErrData ) && <p className="text-red-500 text-sm mt-1">Please input a valid {provider.replace("-airtime", "")} number</p>
                    }
                    {isVerifying && <motion.div initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: .5}}} className="flex items-center gap-2"><Loader2 className="animate-spin size-4 mt-2" /> <span className="italic text-sm">Verifying phone number</span></motion.div>}
                    {
                        verifiedPhone?.isValid && <motion.div initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: .5}}} className="flex mt-1 items-center gap-2">
                            <div className="grid place-items-center size-6 rounded-full border-2 border-[#039855] bg-[#12B76A] text-white"><BsCheck2Circle className="size-2.5" /> </div>
                            <p className="text-sm font-medium">Verified</p>
                        </motion.div>
                    }
                    
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
                        <input 
                            {...register("amount")} 
                            placeholder="Amount to purchase" 
                            className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]"  
                            onInput={(e) => {
                                const input = e.target as HTMLInputElement;
                                input.value = input.value.replace(/[^0-9]/g, '');
                            }} 
                            type="text" 
                            min={50} 
                            inputMode="numeric" 
                            pattern="[0-9]*" 
                            id="amount" 
                        />
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2">₦</span>
                    </div>
                    {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>}
                </div>

                <CustomButton disabled={!provider} className="w-full mt-5">Proceed - <span className="opacity-60">Confirm Purchase</span></CustomButton>
            </form>
        </section>
  )
}

export default RecipientDetails