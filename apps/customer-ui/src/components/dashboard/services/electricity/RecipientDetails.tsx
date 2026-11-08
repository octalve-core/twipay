import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {motion} from "framer-motion"

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

import CustomButton from "@/components/CustomButton"
import { ElectricityFormSchema } from "@/lib/zodSchemas/dashboard.schema"
  import { BsCheck2Circle } from "react-icons/bs";
import { cn } from "@/lib/utils"
import useElectricityBillsStore from "@/stores/useElectricityBillsStore"
import BackButton from "@/components/Authentication/BackButton"
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, Loader2 } from "lucide-react"
import { ElectricityProvider } from "./SelectProvider"
import { useMutation, useQuery } from "@tanstack/react-query"
import { fetchElectricityProviders, verifyMeterNumber } from "@/lib/api/dashboard-apis/servicesApis"
import { AxiosError } from "axios"
// import { toast } from "sonner"

const MeterTypes = [
    {
        id: 1,
        name: "prepaid",
        label: "Prepaid"
    },
    {
        id: 2,
        name: "postpaid",
        label: "Postpaid"
    },
]

interface ElectricityVerificationResponse {
  customerName: string;
  meterType: string;
  address: string;
  valid: boolean;
}

interface VerifyMeterPayload {
  providerCode: string;
  type: string;
  number: string;
}

type TFormData = z.infer<typeof ElectricityFormSchema>

const RecipientDetails = () => {
    const [showDropdown, setShowDropdown] = useState(false);
    const navigate = useNavigate()
    const {update, step, meterType, provider} = useElectricityBillsStore();

    const {
        data: providers,
        isLoading,
    } = useQuery<ElectricityProvider[], Error>({
        queryKey: ["electricity-providers"],
        queryFn: fetchElectricityProviders,
    })

    const selectedProvider =  useMemo(() => providers?.find((prov) => prov.id === provider), [provider, providers]);

    const {mutate, isPending: isVerifying, data: verifiedMeter, error: verifyError} = useMutation<ElectricityVerificationResponse, AxiosError, VerifyMeterPayload>({
        mutationFn: verifyMeterNumber,
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
        register,
        formState: {errors},
        watch,
        handleSubmit,
    } =  useForm<TFormData>({
        resolver: zodResolver(ElectricityFormSchema)
    })

    const meterNo = watch("meterNumber");

    useEffect(() => {
      const delayDebounce = setTimeout(() => {
        if(meterNo && meterNo.length >= 11 && provider && meterType){
            mutate({providerCode: selectedProvider?.code as string, type: meterType, number: meterNo})
        }
      }, 1000);
    
      return () => clearTimeout(delayDebounce)
    }, [meterNo, mutate, provider, meterType, selectedProvider])
    

    const onSubmit = (data: TFormData) => {
        update({step: step+1, meterNumber: data.meterNumber, quantity: data.quantity});
    }

  return (
    <section className="w-full max-w-[410px] mx-auto">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon action={() =>navigate(-1)} />
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Buy Electricity</p>
        </div>

        <div className="hidden md:block">
            <BackButton className="mb-8" action={() => update({step: 1})} /> 
            <h1 className="font-medium text-2xl text-[#112929] ">Recipient details</h1>
            <h2 className=" text-[#717171]">Please enter your recipient details for this purchase</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-14 md:mt-5 flex flex-col gap-5">
            <div className="">
                <h3 className="text-[#344054] text-sm font-medium mb-1.5">Meter type</h3>
                <div className="flex items-center gap-4">
                    {
                        MeterTypes.map(({id, name, label}) => {
                            const isSelected = meterType === name;
                            return (
                                <button 
                                    key={id} 
                                    onClick={() => update({meterType: name})} 
                                    type="button" 
                                    className={cn("relative w-full h-8 cursor-pointer border py-2 px-2.5 rounded-sm text-xs", isSelected ? "text-white" : "border-[#475467]/20 text-[#475467] bg-white" )}
                                >
                                    <span className="z-[2] relative">{label}</span>
                                    {isSelected && <motion.span
                                        layoutId="selected"
                                        className="absolute z-[1] border-[#1A1A31] inset-0 bg-[#1A1A31] rounded-sm"
                                        ></motion.span>}
                                </button>
                            )
                        })
                    }
                </div>
            </div>
            
            <div className="w-full md:hidden">
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
                                : `${isLoading ? "Fetching electricity provider..." : "Select Electricity provider"}`}

                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </CustomButton>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[90vw] md:w-[361px]">
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

            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="meterNumber">Meter number</label>
                <input {...register("meterNumber")} placeholder="Enter meter number" className="w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="text" id="meterNumber" />
                {
                    (!isVerifying && verifyErrData ) && <p className="text-red-600 text-sm mt-1">{verifyErrData?.message}</p>
                }
                {isVerifying && <motion.div initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: .5}}} className="flex items-center gap-2"><Loader2 className="animate-spin size-4 mt-2" /> <span className="italic text-sm">Verifying meter number</span></motion.div>}
                {
                    verifiedMeter && <motion.div initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: .5}}} className="flex mt-1 items-center gap-2">
                    <div className="grid place-items-center size-6 rounded-full border-2 border-[#039855] bg-[#12B76A] text-white"><BsCheck2Circle className="size-2.5" /> </div>
                    <p className="text-sm font-medium">{verifiedMeter.customerName}</p>
                </motion.div>
                }
                {errors.meterNumber && <p className="text-red-600 text-sm mt-1">{errors.meterNumber.message}</p>}
            </div>

            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="quantity">Amount</label>
                <input {...register("quantity")} placeholder="1,000" className="w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="text" id="quantity" />
                {errors.quantity && <p className="text-red-600 text-sm mt-1">{errors.quantity.message}</p>}
            </div>

            <CustomButton disabled={!provider} className="w-full">Proceed - <span className="opacity-60">Confirm Purchase</span></CustomButton>
        </form>
    </section>
  )
}

export default RecipientDetails;