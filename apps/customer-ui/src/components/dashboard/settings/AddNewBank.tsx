import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { BsCheck2Circle } from "react-icons/bs"
import { z } from "zod"
import {motion} from "framer-motion"

import CustomButton from "@/components/CustomButton"
import { UpdateBankInfoFormSchema } from "@/lib/zodSchemas/dashboard.schema"

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
import { fetchBankList } from "@/lib/api/dashboard-apis/walletApis"
import { TBank } from "../withdraw-funds/RecipientDetailForm"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Check, ChevronDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { addBankAccount, verifyBankAccount } from "@/lib/api/dashboard-apis/settingsApis"
import { AxiosError } from "axios"
import { toast } from "sonner"

type TFormData = z.infer<typeof UpdateBankInfoFormSchema>

export type TAccountVerResponse = {
    accountNumber: string,
    accountName: string
    bankCode: string
}

export type verifyBankAccountPayload =  {bankCode: string; accountNumber: string;}

const AddNewBank = ({showBankInfo}: {showBankInfo: () => void}) => {
    const [showBanksDropdown, setShowBanksDropdown] = useState(false);
    const [selectedBank, setSelectedBank] = useState<TBank | null | undefined>(null);

    const {
        data: banks,
        isLoading: fetchingBanks,
        error: fetchBankError
    } = useQuery<TBank[], Error>({
        queryKey: ["bank-list"],
        queryFn: fetchBankList,
    })

    const {mutate, isPending: isVerifying, data: verifiedAccount, error: verAccError} = useMutation<TAccountVerResponse, AxiosError, verifyBankAccountPayload>({
        mutationFn: verifyBankAccount,
        onSuccess: (data) => {
            void 0;
        },
        onError: (error: AxiosError) => {
            void 0;
        }
    })

    const {mutate: addAccount, isPending: addingAccount} = useMutation({
      mutationFn: addBankAccount,
      onSuccess: () => {
        toast.success("Account added successfully!");
        showBankInfo()
      },
      onError: (error: AxiosError) => {
        void 0;
        const errData = error.response?.data as { message?: string };
        if(errData.message){
            return toast.error(errData.message)
        }
        toast.error("Something went wrong, please try again")
      }
    })

    const {
        register,
        formState: {errors},
        handleSubmit,
        watch
    } = useForm<TFormData>({
        resolver: zodResolver(UpdateBankInfoFormSchema)
    })

    const accountNumber = watch("accountNumber");

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
        if(accountNumber && accountNumber.length >= 8 && selectedBank){
            mutate({bankCode: selectedBank.bankCode, accountNumber})
        }
    }, 1000);
    
        return () => clearTimeout(delayDebounce)
    }, [mutate, accountNumber, selectedBank])

    const onSubmit = (data: TFormData) => {
        if(!selectedBank || !verifiedAccount) return;
        addAccount({bankCode: selectedBank.bankCode, accountNumber: data.accountNumber, accountName: verifiedAccount.accountName})
    }

  return (
    <section className="w-full max-w-[360px] mx-auto">
        <div className="flex items-center fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5 mt-2 md:hidden">
            <BackButton icon action={showBankInfo}/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Bank info</p>
        </div>

        <div className="hidden md:block">
            <BackButton action={showBankInfo} className="mb-5" />  
            <h1 className="text-[#112929] font-bold text-[28px]">Save bank info</h1>
            <p className="text-[#667085]  text-sm mt-1">Enter a bank account for withdrawals</p>
        </div>

        <form className="mt-14 md:mt-12" onSubmit={handleSubmit(onSubmit)}>
            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="account">Bank name</label>
                <Popover open={showBanksDropdown} onOpenChange={setShowBanksDropdown}>
                    <PopoverTrigger asChild>
                        <CustomButton
                            disabled={fetchingBanks}
                            aria-expanded={open}
                            className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#344054] flex items-center justify-between text-sm"
                        >
                            {selectedBank
                                ? <span>{selectedBank.name}</span>
                                : `${fetchingBanks ? "Loading banks..." : "Select bank"}`}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </CustomButton>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[90vw] md:w-[360px]">
                        <Command className="">
                            <CommandInput className="" placeholder="search..." />
                            <CommandList className="w-full px-3.5">
                                <CommandEmpty>No bank found.</CommandEmpty>
                            <CommandGroup className="px-0">
                                {banks && banks.map((bank) => (
                                    <CommandItem
                                        className={cn("text-[#344054] justify-between", selectedBank && bank.name === selectedBank.name && "font-medium")}
                                        key={bank.bankCode}
                                        value={bank.name}
                                        onSelect={(currentValue) => {
                                            const bankDetails = banks.find((bnk) => bnk.name === currentValue);
                                            const newBank = bankDetails === selectedBank ? null : bankDetails
                                            setSelectedBank(newBank)

                                            setShowBanksDropdown(false);
                                        }}
                                    >
                                        <span>{bank.name}</span>
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedBank?.name === bank.name ? "opacity-100" : "opacity-0"
                                            )} 
                                             
                                        />
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                {fetchBankError && <p className="text-red-600 mt-1 text-sm">Failed to load banks. Please refresh.</p>}
            </div>

            <div className="w-full mt-5">
                <label className="text-sm text-[#344054] font-medium" htmlFor="accountNumber">Account number</label>
                <input {...register("accountNumber")} placeholder="Enter account number" className="w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="text" id="accountNumber" />
                {isVerifying && <motion.div initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: .5}}} className="flex items-center gap-2"><Loader2 className="animate-spin size-4 mt-2" /> <span className="italic text-sm">Verifying account number</span></motion.div>}
                {
                    verifiedAccount && <motion.div className="flex mt-1 items-center gap-2">
                    <div className="grid place-items-center size-6 rounded-full border-2 border-[#039855] bg-[#12B76A] text-white"><BsCheck2Circle className="size-2.5" /> </div>
                        <p className="text-sm font-medium">{verifiedAccount.accountName}</p>
                    </motion.div>
                }
                {verAccError && <p className="text-red-600 text-sm mt-1">Something went wrong, please try again</p>}
                {errors.accountNumber && <p className="text-red-600 text-sm mt-1">{errors.accountNumber.message}</p>}
            </div>  

            <CustomButton isLoading={addingAccount} disabled={isVerifying || !selectedBank || !verifiedAccount || addingAccount} className="mt-12 w-full">Save</CustomButton>             
        </form>
    </section>
  )
}

export default AddNewBank