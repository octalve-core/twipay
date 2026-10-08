import CustomButton from "@/components/CustomButton";
import { getWallet } from "@/lib/api/dashboard-apis/walletApis";
import { formatAmount } from "@/lib/utils";
import { TransferFundsSchema } from "@/lib/zodSchemas/dashboard.schema";
import useTransferFunds from "@/stores/useTransferFundsStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Wallet } from "../main-page/BalanceCard";
import { Loader2 } from "lucide-react";


type TFormData = z.infer<typeof TransferFundsSchema>

const TransferFundsForm = () => {
    const {update} = useTransferFunds();
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
        resolver: zodResolver(TransferFundsSchema)
    })

    const onSubmit = (data: TFormData) => {
        (void 0)
        update({ step: 2, user: data.user, note: data.note, amount: data.amount})
    }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full mt-14 md:mt-8">
        <div className="w-full">
            <label className="text-sm text-[#344054] font-medium" htmlFor="email">Recipient email</label>
            <input {...register("user")} placeholder="Enter email" className="w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="email" id="email" />
            {/* <div className="flex mt-1 items-center gap-2">
                <div className="grid place-items-center size-6 rounded-full border-2 border-[#039855] bg-[#12B76A] text-white"><BsCheck2Circle className="size-2.5" /> </div>
                <p className="text-sm font-medium">Anna Keshinro</p>
            </div> */}
            {errors.user && <p className="text-red-500 text-sm mt-1">{errors.user.message}</p>}
        </div>

        <div className="w-full mt-5">
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

        <CustomButton className="mt-10 w-full">Proceed - <span className="opacity-60">Confirm transfer</span></CustomButton>
    </form>
  )
}

export default TransferFundsForm