import CustomButton from "@/components/CustomButton"
import { BettingServiceFormSchema } from "@/lib/zodSchemas/dashboard.schema"
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

import { Check, ChevronDown, Loader2 } from "lucide-react";

import useBettingStore from "@/stores/useBettingStore"
import BackButton from "@/components/Authentication/BackButton"
import { useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { cn, formatAmount } from "@/lib/utils"
import { fetchBettingProviders, verifyBettingWalletNumber } from "@/lib/api/dashboard-apis/servicesApis"
import { BettingProvider } from "./SelectProvider"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AxiosError } from "axios"
import { BsCheck2Circle } from "react-icons/bs"
import { getWallet } from "@/lib/api/dashboard-apis/walletApis"
import { Wallet } from "../../main-page/BalanceCard"

type TBetWalletVerificationResponse = {
    firstname: string,
    lastname: string,
    username: string
  }

export type verifyBetWalletPayload = {providerId: string, number: string}

type TFormData = z.infer<typeof BettingServiceFormSchema>

const RecipientDetails = () => {
    const [showDropdown, setShowDropdown] = useState(false);
    const navigate = useNavigate()
    const {update, step, provider} = useBettingStore();

    const {
        data: wallet,
        isLoading: fetchingWallet
    } = useQuery<Wallet, Error>({
        queryKey: ["countries"],
        queryFn: getWallet,
    })

    const {
        data: providers,
        isLoading,
    } = useQuery<BettingProvider[], Error>({
        queryKey: ["betting-providers"],
        queryFn: fetchBettingProviders,
    })

    const selectedProvider =  providers?.find((prov) => prov.id === provider);

    const {mutate, isPending: isVerifying, data: verifiedWallet, error: verifyError} = useMutation<TBetWalletVerificationResponse, AxiosError, verifyBetWalletPayload>({
        mutationFn: verifyBettingWalletNumber,
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
        register,
        formState: {errors},
        handleSubmit,
        watch
    } =  useForm<TFormData>({
        resolver: zodResolver(BettingServiceFormSchema)
    })

    const walletNo = watch("user");

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
        if(walletNo && walletNo.length >= 4 && provider && provider){
            mutate({providerId: provider, number: walletNo})
        }
        }, 1000);
    
        return () => clearTimeout(delayDebounce)
    }, [mutate, provider, walletNo])

    const onSubmit = (data: TFormData) => {
        update({step: step+1, amount: data.amount, user: data.user});
    }

  return (
    <section className="w-full max-w-[360px] mx-auto">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon action={() =>navigate(-1)}/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Fund betting</p>
        </div>

        <div className="hidden md:block">
            <BackButton className="mb-8" action={() => update({step:step-1})} /> 
            <h1 className="font-medium text-2xl text-[#112929] ">Recipient details</h1>
            <h2 className=" text-[#717171]">Please enter your recipient details for this purchase</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-14 md:mt-5 flex flex-col gap-5 md:gap-5">            
            <div className="w-full md:hidden">
                <label className="text-sm text-[#344054] font-medium" htmlFor="account">Betting Provider</label>
                <Popover open={showDropdown} onOpenChange={setShowDropdown}>
                    <PopoverTrigger asChild>
                        <CustomButton
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
            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="user">User ID/Phone number</label>
                <input {...register("user")} placeholder="User ID/Phone number" className="w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="text" id="user" />
                {
                    (!isVerifying && verifyErrData ) && <p className="text-red-500 text-sm mt-1">{verifyErrData?.message}</p>
                }
                {isVerifying && <motion.div initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: .5}}} className="flex items-center gap-2"><Loader2 className="animate-spin size-4 mt-2" /> <span className="italic text-sm">Verifying user id</span></motion.div>}
                {
                    verifiedWallet && <motion.div initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: .5}}} className="flex mt-1 items-center gap-2">
                    <div className="grid place-items-center size-6 rounded-full border-2 border-[#039855] bg-[#12B76A] text-white"><BsCheck2Circle className="size-2.5" /> </div>
                        <p className="text-sm font-medium">{verifiedWallet.firstname} {verifiedWallet.lastname}</p>
                    </motion.div>
                }
                {errors.user && <p className="text-red-500 text-sm mt-1">{errors.user.message}</p>}
            </div>

            <div className="w-full">
                <div className="flex items-center justify-between">
                    <label className="text-sm text-[#344054] font-medium" htmlFor="amount">Amount</label>
                    <p className="text-xs text-[#464E60] md:hidden flex items-center gap-1">Available balance :
                        <span className="font-bold">
                            {fetchingWallet ? <Loader2 className="animate-spin size-4" />
                            : formatAmount(wallet?.balance as number)}
                        </span>
                    </p>
                </div>
                <div className="w-full h-fit relative mt-1.5">
                    <input {...register("amount")} placeholder="Amount to purchase" className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="number" min={1} id="amount" />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2">₦</span>
                </div>
                {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>}
            </div>

            <CustomButton disabled={!provider} className="w-full">Proceed - <span className="opacity-60">Confirm Purchase</span></CustomButton>
        </form>
    </section>
  )
}

export default RecipientDetails