import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import BackButton from "@/components/Authentication/BackButton";
import CustomButton from "@/components/CustomButton";
import { AddFundsAmountFormSchema } from "@/lib/zodSchemas/dashboard.schema";
import useAddFundsStore from "@/stores/useAddFundsStore";

type TFormData = z.infer<typeof AddFundsAmountFormSchema>

const EnterAmount = () => {
    const {update} = useAddFundsStore();

    const {
            register,
            formState: {errors},
            handleSubmit
    } = useForm<TFormData>({
        resolver: zodResolver(AddFundsAmountFormSchema)
    })

    const onSubmit = (data: TFormData) => {
        update({step: 2, amount: data.amount});
    }

  return (
    <section className="w-full max-w-[360px] mx-auto max-md:self-start">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon href="/dashboard"/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Fund account</p>
        </div>

        <div className="max-md:hidden">
            <BackButton className="mb-8" href="/dashboard" />
            <h1 className="text-[#112929] font-medium text-2xl">Add funds</h1>
            <p className="text-[#717171] mt-2">Entire the details below to add funds to this account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="w-full mt-14 md:mt-5">
            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="amount">Amount to fund</label>
                <div className="w-full h-fit relative mt-1.5">
                    <input {...register("amount")} placeholder="5,000" className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="text" inputMode="decimal" autoComplete="off" id="amount" />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2">₦</span>
                </div>
                {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>}
            </div>
            <CustomButton className="mt-10 md:mt-5 w-full">Proceed - <span className="opacity-60">Payment method</span></CustomButton>
        </form>
    </section>
  )
}

export default EnterAmount