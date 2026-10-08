import { formatNgnMinorUnits } from "@/lib/money";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
  import { zodResolver } from "@hookform/resolvers/zod"
  import { Controller, useForm } from "react-hook-form"
  import { z } from "zod"

import CustomButton from "@/components/CustomButton"
import { MobileMoneySchema } from "@/lib/zodSchemas/dashboard.schema"
import useMobileMoneyStore from "@/stores/useMobileMoneyStore"
import BackButton from "@/components/Authentication/BackButton";
import { useNavigate } from "react-router-dom";
import { Wallet } from "../../main-page/BalanceCard";
import { useQuery } from "@tanstack/react-query";
import { getWallet } from "@/lib/api/dashboard-apis/walletApis";
import { Loader2 } from "lucide-react";

type TFormData = z.infer<typeof MobileMoneySchema>

const RecipientDetails = () => {
    const navigate = useNavigate()
    const {update} = useMobileMoneyStore()
    const {
        data: wallet,
        isLoading: fetchingWallet
    } = useQuery<Wallet, Error>({
        queryKey: ["wallet", "twipay-v1"],
        queryFn: getWallet,
    })

    const {
        register,
        formState: {errors},
        handleSubmit,
        control
    } =  useForm<TFormData>({
        resolver: zodResolver(MobileMoneySchema)
    })

    const onSubmit = (data: TFormData) => {
        update({step: 2, provider: data.provider, wallet_no: data.wallet_no, amount: data.amount})    
    }

  return (
    <section className="w-full max-w-[410px] mx-auto">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon action={() =>navigate(-1)} />
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Payments</p>
        </div>

        <div className="hidden md:block">
            <BackButton className="mb-8" action={() =>navigate(-1)} /> 
            <h1 className="font-medium text-2xl text-[#112929] ">Recipient details</h1>
            <h2 className=" text-[#717171]">Please enter your recipient details for this purchase</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-14 md:mt-5 flex flex-col gap-5">
            <Controller
                name="provider"
                control={control}
                rules={{ required: true}}
                render={({field}) => (
                    <div className="w-full">
                        <label className="text-sm text-[#344054] font-medium" htmlFor="account">Provider</label>
                        <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-placeholder:text-[#667085]">
                                <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                <SelectGroup>
                                    <SelectItem className="capitalize" value="MTN (MOMO)">MTN (MOMO)</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        {errors.provider && <p className="text-red-500 text-sm mt-1">{errors.provider.message}</p>}
                    </div>
                )}
            />

            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="wallet_no">Wallet number</label>
                <div className="w-full h-fit mt-1.5">
                    <input {...register("wallet_no")} placeholder="Enter wallet number" className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="number" min={1} id="wallet_no" />
                </div>
                {errors.wallet_no && <p className="text-red-500 text-sm mt-1">{errors.wallet_no.message}</p>}
            </div>

            <div className="w-full">
                <div className="flex items-center justify-between">
                    <label className="text-sm text-[#344054] font-medium" htmlFor="amount">Amount</label>
                    <p className="text-xs text-[#464E60] md:hidden flex items-center gap-1">Available balance :
                        <span className="font-bold">
                            {fetchingWallet ? <Loader2 className="animate-spin size-4" />
                            : wallet ? formatNgnMinorUnits(wallet.availableBalanceMinor) : "Unavailable"}
                        </span>
                    </p>
                </div>
                <div className="w-full h-fit relative mt-1.5">
                    <input {...register("amount")} placeholder="Amount to pay" className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="number" min={1} id="amount" />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2">₦</span>
                </div>
                {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>}
            </div>

            <CustomButton className="w-full">Proceed - <span className="opacity-60">Confirm Purchase</span></CustomButton>
        </form>
    </section>
  )
}

export default RecipientDetails;