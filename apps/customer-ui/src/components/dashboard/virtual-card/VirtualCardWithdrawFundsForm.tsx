import { CardWithdrawFormSchema } from "@/lib/zodSchemas/dashboard.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { BsCheck2Circle } from "react-icons/bs";
import { z } from "zod";

import Card from "@/assets/dashboard/Card.svg"

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";

  import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog";

import {  ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import CustomButton from "@/components/CustomButton";
import useVirtualCardWithdraw from "@/stores/useVirtualCardWithdraw";
import { formatAmount } from "@/lib/utils";
import BackButton from "@/components/Authentication/BackButton";

export type TFormData = z.infer<typeof CardWithdrawFormSchema>

const VirtualCardWithdrawFundsForm = () => {
    const [openDialog, setOpenDialog] = useState(false);

    const { update} = useVirtualCardWithdraw();
    const formRef = useRef<HTMLFormElement>(null);

    const {
            register,
            formState: {errors},
            control,
            watch,
            handleSubmit
    } = useForm<TFormData>({
        resolver: zodResolver(CardWithdrawFormSchema)
    })

    const onSubmit = (data: TFormData) => {
        update({withdrawalDetails: data, showPinForm: true})
    }

    const handleProceed = () => {
        if(formRef.current){
            formRef.current.requestSubmit();
        }
        setOpenDialog(false);
    }

    const bank = watch("bank");
    const account = watch("account_no");
    const amount = watch("amount");

  return (
    <section className="w-full max-w-[410px] mx-auto max-md:self-start">
        <div className="flex items-center fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5 mt-2 md:hidden">
            <BackButton icon href="/dashboard/virtual-card"/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Withdraw funds</p>
        </div>

        <div className="hidden md:block">
            <BackButton href="/dashboard/virtual-card" className="mb-8" />  
            <h1 className="text-[#112929] font-bold text-[28px]">Withdraw from virtual card</h1>
            <p className="text-[#667085]  text-sm mt-1">Withdraw funds from your virtual card.</p>
        </div>

        <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="w-full mt-14 md:mt-10">
                <Controller
                    name="bank"
                    control={control}
                    rules={{ required: true}}
                    render={({field}) => (
                        <div className="w-full">
                            <label className="text-sm text-[#344054] font-medium" htmlFor="account">Bank name</label>
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-placeholder:text-[#667085]">
                                    <SelectValue placeholder="Select a bank" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectGroup>
                                        <SelectItem className="capitalize" value="first bank">first bank</SelectItem>
                                        <SelectItem className="capitalize"   value="wema bank">wema bank</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            {errors.bank && <p className="text-red-600 text-sm mt-1">{errors.bank.message}</p>}
                        </div>
                    )}
                />

            <div className="w-full mt-5 md:mt-10">
                <label className="text-sm text-[#344054] font-medium" htmlFor="account">Account number</label>
                <input {...register("account_no")} placeholder="Enter account number" className="w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="text" id="account" />
                <div className="flex mt-1 items-center gap-2">
                    <div className="grid place-items-center size-6 rounded-full border-2 border-[#039855] bg-[#12B76A] text-white"><BsCheck2Circle className="size-2.5" /> </div>
                    <p className="text-sm font-medium">Anna Keshinro</p>
                </div>
                {errors.account_no && <p className="text-red-600 text-sm mt-1">{errors.account_no.message}</p>}
            </div>

            <div className="w-full mt-5 md:mt-10">
                <label className="text-sm text-[#344054] font-medium" htmlFor="amount">Amount</label>
                <div className="w-full h-fit relative">
                    <input {...register("amount")} placeholder="5,000" className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="number" min={1} id="amount" />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2">₦</span>
                </div>
                {errors.amount && <p className="text-red-600 text-sm mt-1">{errors.amount.message}</p>}
            </div>

            <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
                <AlertDialogTrigger asChild>
                    <button disabled={!bank || !account || !amount} className="my-10 w-full rounded-[8px] py-2.5 px-6 md:px-[18px] transition cursor-pointer text-white bg-[#112929] hover:opacity-75 disabled:opacity-65 disabled:pointer-events-none">Proceed - <span className="opacity-60">Confirm transaction</span></button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-white border-0 rounded-lg w-[95vw] !max-w-[500px] h-full !max-h-[324px] md:!max-h-[385px] !p-0 flex flex-col items-center justify-center">
                    <div className="w-full flex items-center h-[61px] md:hidden border-b border-[#E9E9E97D] px-4">
                        <BackButton icon action={() => setOpenDialog(false)} />
                        <p className="text-[#1C1C1C] text-lg w-full text-center mr-6">Withdraw from card</p>
                    </div>
                    <div className="w-[90%] md:w-full max-w-[360px] mx-auto">
                        <AlertDialogHeader>
                            <BackButton action={() => setOpenDialog(false)} className="mb-8 max-md:hidden" />  
                            <AlertDialogTitle className="text-black md:text-[#112929] text-[22px] md:text-[28px] font-medium md:font-bold leading-7">
                                Withdraw from virtual card
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-[#667085] text-sm mt-1 mb-3 max-md:hidden">
                                Withdraw funds span.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <p className=" text-[#717171] md:text-xl mb-8 md:mb-5 max-md:text-center max-md:mt-3">Are you sure you want to withdraw {formatAmount(parseInt(amount))} to {account} ({bank}) ?</p>
                        <div className="flex flex-col w-full gap-2">
                            <CustomButton onClick={handleProceed}>Yes, Proceed</CustomButton>
                            <CustomButton className="text-[#112929] font-medium" onClick={() => setOpenDialog(false)} variant="primary">No, cancel</CustomButton>
                        </div>
                    </div>
                </AlertDialogContent>
            </AlertDialog>

            <section>
                <h2 className="text-center text-sm md:text-lg text-[#313744] mb-4 md:mb-5">or use a saved bank account</h2>
                <div className="w-full flex items-center justify-between rounded-[13px] p-4 bg-white">
                    <div className="flex items-start gap-2.5">
                        <img alt="" src={Card} className="w-[40px] h-[25px] object-cover" />
                        <div className="flex flex-col">
                            <p className="font-medium text-[#344054] md:text-lg">Anna Keshinro</p>
                            <p className="text-sm md:text-base text-[#3C3C4399]">7060908022</p>
                            <p className="text-sm md:text-base text-[#3C3C4399]">Opay</p>
                        </div>
                    </div>
                    <ChevronRight className=" text-[#3C3C4399]" />
                </div>
            </section>
        </form>
    </section>
  )
}

export default VirtualCardWithdrawFundsForm