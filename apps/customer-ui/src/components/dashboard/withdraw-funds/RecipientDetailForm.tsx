import { RecipientDetailFormSchema } from "@/lib/zodSchemas/dashboard.schema";
import useWithdrawFundsStore from "@/stores/useWithdrawFunds";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { BsCheck2Circle } from "react-icons/bs";
import {motion} from "framer-motion"
import { z } from "zod";

import Card from "@/assets/dashboard/Card.svg"

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

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CustomButton from "@/components/CustomButton";
import { fetchBankList } from "@/lib/api/dashboard-apis/walletApis";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AxiosError } from "axios";
import { TAccountVerResponse, verifyBankAccountPayload } from "../settings/AddNewBank";
import { addBankAccount, getSavedAccounts, verifyBankAccount } from "@/lib/api/dashboard-apis/settingsApis";
import { TSavedBankAccount } from "../settings/BankInfo";
import { twMerge } from "tailwind-merge";

export type TBank = {
    routingKey: string,
    name: string,
    bankCode: string,
    logoImage: string,
    categoryId: string,
    nubanCode: string,
    alias: string[]
}

type TFormData = z.infer<typeof RecipientDetailFormSchema>

const RecipientDetailForm = () => {
    const [checked, setChecked] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);

    const [showBanksDropdown, setShowBanksDropdown] = useState(false);

    const formRef = useRef<HTMLFormElement>(null);
    const {update, amount, selectedBank} = useWithdrawFundsStore();

    const {mutate, isPending: isVerifying, data: verifiedAccount, error: verAccError} = useMutation<TAccountVerResponse, AxiosError, verifyBankAccountPayload>({
        mutationFn: verifyBankAccount,
        onSuccess: (data) => {
            (void 0)
        },
        onError: (error: AxiosError) => {
            (void 0)
        }
    })

    const {
        data: accounts,
        // isLoading: loadingSavedAccounts,
    } = useQuery<TSavedBankAccount[], Error>({
        queryKey: ["bank-accounts"],
        queryFn: getSavedAccounts,
    })

    const {
        data: banks,
        isLoading: fetchingBanks,
        error: fetchBankError
    } = useQuery<TBank[], Error>({
        queryKey: ["bank-list"],
        queryFn: fetchBankList,
    })

    const {mutate: addAccount} = useMutation({
        mutationFn: addBankAccount,
    })

    const {
            register,
            formState: {errors},
            watch,
            reset,
            handleSubmit
    } = useForm<TFormData>({
        resolver: zodResolver(RecipientDetailFormSchema),
        defaultValues: {
            amount
        }
    })

    const onSubmit = (data: TFormData) => {
        (void 0)

        if(checked){
            addAccount({accountName: verifiedAccount?.accountName as string, accountNumber: data.account_no, bankCode: selectedBank?.bankCode as string});
        }
        
        update({step: 3, bank_account: data.account_no, accountName: verifiedAccount?.accountName, amount: data.amount, save: checked});
    }

    const handleProceed = () => {
        if(formRef.current){
            formRef.current.requestSubmit();
        }
        setOpenDialog(false);
    }

    const setSavedBank = (account: TSavedBankAccount) => {
        const savedBankDetails = banks?.find((bank) => bank.bankCode === account.bankCode);
        if(savedBankDetails){
            update({selectedBank: savedBankDetails, bank_account: account.accountNumber, accountName: account.accountName});
            reset({amount, account_no: account.accountNumber});
        }
        
    }
    
    const accountNumber = watch("account_no");

    useEffect(() => {
        (void 0)
        const delayDebounce = setTimeout(() => {
        if(accountNumber && accountNumber.length >= 8 && selectedBank){
            mutate({bankCode: selectedBank.bankCode, accountNumber})
        }
    }, 1000);
    
        return () => clearTimeout(delayDebounce)
    }, [mutate, accountNumber, selectedBank])

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="w-full mt-14 md:mt-5">
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
                                    className={cn("text-[#344054] justify-between", selectedBank && bank.bankCode === selectedBank.bankCode && "font-medium")}
                                    key={bank.bankCode}
                                    value={bank.name}
                                    onSelect={(currentValue) => {
                                        const bankDetails = banks.find((bnk) => bnk.name === currentValue);
                                        const newBank = bankDetails === selectedBank ? null : bankDetails
                                        update({selectedBank: newBank})

                                        setShowBanksDropdown(false);
                                    }}
                                >
                                    <span>{bank.name}</span>
                                    <Check
                                        className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedBank?.bankCode === bank.bankCode ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                </CommandItem>
                            ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {fetchBankError && <p className="text-red-500 mt-1 text-sm">Failed to load banks. Please refresh.</p>}
        </div>

        <div className="w-full mt-5">
            <label className="text-sm text-[#344054] font-medium" htmlFor="account">Account number</label>
            <input {...register("account_no")} placeholder="Enter account number" className="w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="text" id="account" />
                {isVerifying && <motion.div initial={{opacity: 0}} animate={{opacity: 1, transition: {duration: .5}}} className="flex items-center gap-2"><Loader2 className="animate-spin size-4 mt-2" /> <span className="italic text-sm">Verifying account number</span></motion.div>}
                {
                    verifiedAccount && <motion.div className="flex mt-1 items-center gap-2">
                    <div className="grid place-items-center size-6 rounded-full border-2 border-[#039855] bg-[#12B76A] text-white"><BsCheck2Circle className="size-2.5" /> </div>
                        <p className="text-sm font-medium">{verifiedAccount.accountName}</p>
                    </motion.div>
                }
                {verAccError && <p className="text-red-500 text-sm mt-1">Something went wrong, please try again</p>}
            {errors.account_no && <p className="text-red-500 text-sm mt-1">{errors.account_no.message}</p>}
        </div>

        <div className="w-full mt-5">
            <label className="text-sm text-[#344054] font-medium" htmlFor="amount">Amount</label>
            <div className="w-full h-fit relative">
                <input {...register("amount")} placeholder="5,000" className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="number" min={1} id="amount" />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2">₦</span>
            </div>
            <label className="flex items-center gap-3 mt-2.5 cursor-pointer">
                <input checked={checked} onChange={(e) => setChecked(e.target.checked)} type="checkbox" className="peer hidden" />
                <div className="size-5 border border-[#112929] rounded-md transition-colors duration-200 flex items-center justify-center 
                                peer-checked:bg-[#1129291A] peer-checked:[&>svg]:opacity-100">
                    <Check className="size-4 text-[#112929] opacity-0 transition-opacity duration-200" />
                </div>
                <span className="text-[#344054]">Save for later</span>
            </label>
            {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>}
        </div>

        <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
            <AlertDialogTrigger asChild>
                <button disabled={!selectedBank || !accountNumber || !amount} className="mt-10 md:mt-5 w-full rounded-[8px] py-2.5 px-6 md:px-[18px] transition cursor-pointer text-white bg-[#112929] hover:opacity-75 disabled:opacity-65 disabled:pointer-events-none">Proceed - <span className="opacity-60">Confirm</span></button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white border-0 rounded-lg w-[95vw] !max-w-[647px] h-full !max-h-[285px] md:!max-h-[385px] !p-0 flex flex-col items-center justify-center">
                <div className="w-[90%] max-w-[360px] mx-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center text-black text-2xl md:text-[28px] font-medium leading-7">Withdraw funds?</AlertDialogTitle>
                        <AlertDialogDescription className="text-center text-[#717171] text-xl mt-3 mb-6">
                            Are you sure you want to withdraw funds from this account? 
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col w-full gap-2">
                        <CustomButton onClick={handleProceed}>Yes, Proceed</CustomButton>
                        <CustomButton onClick={() => setOpenDialog(false)} variant="primary">No, cancel</CustomButton>
                    </div>
                </div>
            </AlertDialogContent>
        </AlertDialog>

        {accounts && accounts.length ? (
            <>
                <p className="text-[#313744] text-sm text-center mt-10 mb-4">or use a saved bank account</p>

                {
                    accounts.map((account) => (
                        <div onClick={() => setSavedBank(account)} className={twMerge("w-full flex items-center justify-between rounded-[13px] p-4 bg-white mb-2 border border-white hover:border-[#112929] cursor-pointer transition", selectedBank?.bankCode === account.bankCode && "border-[#112929]") } key={account._id}>
                            <div className="flex items-start gap-2.5">
                                <img src={Card} className="w-[40px] h-[25px] object-cover" />
                                <div className="flex flex-col">
                                    <p className="font-medium text-[#344054] md:text-lg">{account.accountName}</p>
                                    <p className="text-sm md:text-base text-[#3C3C4399]">{account.accountNumber}</p>
                                    <p className="text-sm md:text-base text-[#3C3C4399]">{account.bankName}</p>
                                </div>
                            </div>
                            <ChevronRight className=" text-[#3C3C4399]" />
                        </div>
                    ))
                }
            </>
        ) : null}
    </form>
  )
}

export default RecipientDetailForm