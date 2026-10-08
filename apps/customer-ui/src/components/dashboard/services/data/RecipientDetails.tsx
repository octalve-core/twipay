import CustomButton from "@/components/CustomButton"
import { DataRecipientDetailFormSchema } from "@/lib/zodSchemas/dashboard.schema"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import PhoneInput from "react-phone-input-2"
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
import usePurchaseDataStore from "@/stores/usePurchaseDataStore"
import { cn, convertToLocalPhoneNumber } from "@/lib/utils"
import BackButton from "@/components/Authentication/BackButton"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { Check, ChevronDown, Loader2 } from "lucide-react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { TDataServiceProvider } from "./SelectProvider"
import { fetchDataPlans, fetchDataProviders, verifyPhoneNumber } from "@/lib/api/dashboard-apis/servicesApis"
import { phoneNoVerificationResponse, VerifyPhoneNoPayload } from "../airtime/RecipientDetails"
import { AxiosError } from "axios"
import { BsCheck2Circle } from "react-icons/bs"

const DataPlanTypes = [
    {
        id: 1,
        name: "DIRECT",
        label: "Direct"
    },
    {
        id: 2,
        name: "SME",
        label: "SME/CG"
    },
] as const

export interface IDataPlan {
  id: string;
  name: string;
  code: string;
  dataType: string;
  validity: string;
  service: string;
  amount: number;
  logo: string;
}

type TFormData = z.infer<typeof DataRecipientDetailFormSchema>

const RecipientDetails = () => {
    const [prodAmount, setProdAmount] = useState<number | undefined>();
    const [showDropdown, setShowDropdown] = useState(false);
    const [showPlansDropdown, setShowPlansDropdown] = useState(false);

    const navigate = useNavigate()
    const [isFocused, setIsFocused] = useState(false);
    const {update, step, providerName, providerId, type, plan, dataPlans} = usePurchaseDataStore();

    const {
        formState: {errors},
        handleSubmit,
        control,
        watch
    } =  useForm<TFormData>({
        resolver: zodResolver(DataRecipientDetailFormSchema)
    })

    const {mutate, isPending: isVerifying, data: verifiedPhone, error: verifyError} = useMutation<phoneNoVerificationResponse, AxiosError, VerifyPhoneNoPayload>({
        mutationFn: verifyPhoneNumber,
        onSuccess: (data) => {
            (void 0)
        },
        onError: (error: AxiosError) => {
            (void 0)
        }
    })

    let verifyErrData: { message?: string } | undefined;
    if (verifyError?.response?.data) {
        verifyErrData = verifyError.response.data;
    }

    const {
        data: providers,
        isLoading,
    } = useQuery<TDataServiceProvider[], Error>({
        queryKey: ["data-providers"],
        queryFn: fetchDataProviders,
    })

    const selectedProvider = providers?.find((prov) => prov.code === providerName)

    
    const {
        data: DataPlans,
        isLoading: fetchingPlans,
        error: fetchPlansError,
        isSuccess
    } = useQuery<IDataPlan[], Error, IDataPlan[], [string, string, "DIRECT" | "SME"]>({
        queryKey: ['data-plans', providerId as string, type],
        queryFn: fetchDataPlans,
        enabled: !!providerId && !!type
    });
    (void 0)

    const selectedPlan = useMemo(() => {
        return dataPlans?.find((dataPlan) => dataPlan.id === plan) ?? null;
    }, [dataPlans, plan]);

    useEffect(() => {
        setProdAmount(selectedPlan?.amount)
    }, [selectedPlan])

    useEffect(() => {
        if (isSuccess && DataPlans) {
            update({ dataPlans: DataPlans });
        }
    }, [isSuccess, DataPlans, update]);

    useEffect(() => {
        update({ plan: "" });
    }, [type, update]);

    const phoneNo = watch("phone");

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
        if(phoneNo && phoneNo.length >= 10 && providerName){
            mutate({phone: convertToLocalPhoneNumber(phoneNo), network: providerName})
        }
        }, 1000);
    
        return () => clearTimeout(delayDebounce)
    }, [phoneNo, mutate, providerName])


    const onSubmit = (data: TFormData) => {
        if(!plan) {
            toast.info("Please select a plan!")
            return;
        }
        const localPhone = convertToLocalPhoneNumber(data.phone) 
        update({step: step+1, phone: localPhone})    
    }

  return (
    <section className="w-full max-w-[364px] mx-auto">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon action={() =>navigate(-1)}/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Buy Data</p>
        </div>

        <div className="hidden md:block">
            <BackButton className="mb-8" action={() => update({step: step-1})} /> 
            <h1 className="font-medium text-2xl text-[#112929] mb-2">Recipient details</h1>
            <h2 className=" text-[#717171]">Please enter your recipient details for this purchase</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-14 md:mt-5 flex flex-col gap-5">
            <div className="">
                <h3 className="text-[#344054] text-sm font-medium mb-1.5">Data plan type</h3>
                <div className="flex items-center gap-4">
                    {
                        DataPlanTypes.map(({id, name, label}) => {
                            const isSelected = type === name;
                            return (
                                <button 
                                    key={id} 
                                    onClick={() => update({type: name})} 
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
                <label className="text-sm text-[#344054] font-medium" htmlFor="account">Network provider</label>
                <Popover open={showDropdown} onOpenChange={setShowDropdown}>
                    <PopoverTrigger asChild>
                        <CustomButton
                            disabled={isLoading}
                            aria-expanded={open}
                            className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                        >
                            {providerName
                                ? <div className="text-[#344054] flex items-center gap-2">
                                    <img src={selectedProvider?.logo} className="size-5 object-cover" />
                                    <span>{selectedProvider?.name.replace("Data", "")}</span>
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
                                {providers && providers.slice(0, 4).map((prov) => (
                                    <CommandItem
                                        className={cn("text-[#344054] justify-between", providerName && prov.code === providerName && "font-medium")}
                                        key={prov.id}
                                        value={prov.code}
                                        onSelect={(currentValue) => {
                                            update(currentValue === providerName ? {providerName: "", providerId: null}: {providerName: currentValue,providerId: prov.id})
                                            setShowDropdown(false)
                                        }}
                                    >
                                        <div className="text-[#344054] flex items-center gap-2">
                                            <img src={prov.logo} className="size-5 object-cover" />
                                            <span
                                                // style={{
                                                //     textColor
                                                // }}
                                            >{prov.name}</span>
                                        </div>
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            providerName === prov.code ? "opacity-100" : "opacity-0"
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
                    (!isVerifying && verifyErrData ) && <p className="text-red-500 text-sm mt-1">{verifyErrData?.message?.replace("-data", "")}</p>
                }
                {isVerifying && <motion.div initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: .5}}} className="flex items-center gap-2"><Loader2 className="animate-spin size-4 mt-2" /> <span className="italic text-sm">Verifying phone number</span></motion.div>}
                {
                    verifiedPhone && <motion.div initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: .5}}} className="flex mt-1 items-center gap-2">
                        <div className="grid place-items-center size-6 rounded-full border-2 border-[#039855] bg-[#12B76A] text-white"><BsCheck2Circle className="size-2.5" /> </div>
                        <p className="text-sm font-medium">Verified</p>
                    </motion.div>
                }
                {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
            </div>

            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="account">Data Plan</label>
                <Popover open={showPlansDropdown} onOpenChange={setShowPlansDropdown}>
                    <PopoverTrigger asChild>
                        <CustomButton
                            disabled={fetchingPlans}
                            aria-expanded={open}
                            className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#667085] flex items-center justify-between text-sm"
                        >
                            {plan
                                ? <div className="text-[#344054] flex items-center gap-2">
                                    <img src={selectedPlan?.logo} className="size-5 rounded-full object-cover" />
                                    <span className="text-left line-clamp-1">{selectedPlan?.name ? selectedPlan?.name : "Empty"}</span>
                                </div>
                                : `${fetchingPlans ? "Fetching plans..." : "Select plan"}`}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </CustomButton>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[90vw] md:w-[364px]">
                        <Command className="">
                            <CommandInput className="" placeholder="search..." />
                            <CommandList className="w-full px-3.5">
                                <CommandEmpty>No plans found.</CommandEmpty>
                                <CommandGroup className="px-0">
                                {DataPlans && DataPlans.map((dataplan) => (
                                    <CommandItem
                                        className={cn("text-[#344054] justify-between", plan && dataplan.id === plan && "font-medium")}
                                        key={dataplan.id}
                                        value={dataplan.id}
                                        onSelect={(currentValue) => {
                                            update({plan: currentValue === plan ? "" : currentValue});
                                            setShowPlansDropdown(false)
                                        }}
                                    >
                                        <div className="text-[#344054] flex items-center gap-2">
                                            <img src={dataplan.logo} className="size-5 rounded-full bg-gray-100 object-cover" />
                                            <span>{dataplan.name}</span>
                                        </div>
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            plan === dataplan.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                {(fetchPlansError && providerId) && <p className="text-red-500 mt-1 text-sm">Failed to load data plans. Please refresh.</p>}
            </div>

            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="amount">Amount</label>
                <div className="w-full h-fit relative mt-1.5">
                    <input disabled defaultValue={prodAmount} className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929]" id="amount" />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2">₦</span>
                </div>
            </div>
            <CustomButton disabled={fetchingPlans || isLoading} className="w-full max-md:mt-5">Proceed - <span className="opacity-60">Confirm Purchase</span></CustomButton>
        </form>
    </section>
  )
}

export default RecipientDetails