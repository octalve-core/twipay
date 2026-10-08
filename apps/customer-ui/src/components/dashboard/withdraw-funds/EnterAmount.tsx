import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import BackButton from "@/components/Authentication/BackButton";
import CustomButton from "@/components/CustomButton";
import { WithdrawalAmountFormSchema } from "@/lib/zodSchemas/dashboard.schema";
import useWithdrawFundsStore from "@/stores/useWithdrawFunds";
import { formatAmount } from "@/lib/utils";
import { Wallet } from "../main-page/BalanceCard";
import { useQuery } from "@tanstack/react-query";
import { getWallet } from "@/lib/api/dashboard-apis/walletApis";
import { Loader2 } from "lucide-react";

type TFormData = z.infer<typeof WithdrawalAmountFormSchema>;

const EnterAmount = () => {
    const {update} = useWithdrawFundsStore();
    const {
        data: wallet,
        isLoading: fetchingWallet
    } = useQuery<Wallet, Error>({
        queryKey: ["countries"],
        queryFn: getWallet,
    })

    const {
            register,
            formState: {errors},
            handleSubmit
    } = useForm<TFormData>({
        resolver: zodResolver(WithdrawalAmountFormSchema)
    })

    const onSubmit = (data: TFormData) => {
        (void 0)
        update({step: 2, amount: data.amount, note: data.note});
    }

  return (
    <section className="w-full max-w-[360px] mx-auto max-md:self-start">
      <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
          <BackButton icon href="/dashboard"/>
          <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Withdraw funds</p>
      </div>

        <div className="max-md:hidden">
            <BackButton className="mb-8" href="/dashboard" />
            <h1 className="text-[#112929] font-medium text-2xl">Withdraw funds</h1>
            <p className="text-[#717171] mt-2">Enter the details below to withdraw funds</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="w-full mt-14 md:mt-5">
            <div className="w-full mt-5">
                <div className="flex items-center justify-between">
                    <label className="text-sm text-[#344054] font-medium" htmlFor="amount">Amount to withdraw</label>
                    <p className="text-xs text-[#464E60] md:hidden flex items-center gap-1">Available balance :
                        <span className="font-bold">
                            {fetchingWallet ? <Loader2 className="animate-spin size-4" />
                            : formatAmount(wallet?.balance as number)}
                        </span>
                    </p>
                </div>
                <div className="w-full h-fit relative mt-1.5">
                    <input {...register("amount")} placeholder="5,000" className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="number" min={1} id="amount" />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2">₦</span>
                </div>
                {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>}
            </div>

            {/* <div className="w-full mt-5">
                <label className="text-sm text-[#344054] font-medium" htmlFor="note">Note (optional)</label>
                <input {...register("note")} placeholder="enter a note" className="w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="text" id="note" />
                {errors.note && <p className="text-red-500 text-sm mt-1">{errors.note.message}</p>}
            </div> */}

            <CustomButton className="mt-10 md:mt-5 w-full">Proceed - <span className="opacity-60">Enter details</span></CustomButton>
        </form>
    </section>
  )
}

export default EnterAmount