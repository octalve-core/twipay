import { LuFolder, LuRefreshCcw } from "react-icons/lu";

import CustomButton from "@/components/CustomButton";
import { formatAmount } from "@/lib/utils";
import useTransferFundsStore from "@/stores/useTransferFundsStore";

import SuccessIcon from "@/assets/dashboard/success_icon.svg";
import FailedIcon from "@/assets/dashboard/fail_icon.svg";

const Status = () => {
    const {txnResult, amount, user, reset} = useTransferFundsStore();

  return (
    <div className="grid place-items-center min-h-full w-full">
        <section className="w-full max-w-[325px] flex flex-col items-center">
            <img alt="" className="h-[113px] w-[124px] md:w-[175px] md:h-[160px] object-cover" src={txnResult ? SuccessIcon : FailedIcon} />
            <h1 className="font-medium text-2xl text-[#112929] mt-2">Transaction {txnResult ? "successful" : "failed"}</h1>
            <p className="md:text-xl text-center mt-3 mb-12 md:my-10 max-md:text-[#717171]">
            Your transfer of <span className="font-medium">{formatAmount(parseInt(amount))}</span> to <span className="font-medium">{user}</span> {txnResult ? "is successful" : "failed"}.
            </p>
            <div className="flex flex-col items-center w-full gap-2">
                <CustomButton className="w-full text-center" href="/dashboard">Return to dashboard</CustomButton>
                {
                    txnResult ? (
                        <CustomButton href={`/receipt?txnId=${txnResult.reference}`} variant="primary" className="flex items-center justify-center gap-3 w-full md:border border-[#112929] font-medium text-[#112929] bg-transparent">
                            <LuFolder className="size-6" />
                            <span>Transaction details</span>
                        </CustomButton>
                    ) : (
                        <CustomButton onClick={() => reset()} variant="primary" className="flex items-center justify-center gap-3 w-full md:border border-[#112929] font-medium text-[#112929] bg-transparent">
                            <LuRefreshCcw className="size-6" />
                            <span>Try again</span>
                        </CustomButton>
                    )
                }
            </div>
        </section>
    </div>
  )
}

export default Status