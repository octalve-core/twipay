import SuccessIcon from "@/assets/dashboard/success_icon.svg";
import FailedIcon from "@/assets/dashboard/fail_icon.svg";

import CustomButton from "@/components/CustomButton";
import { formatAmount } from "@/lib/utils";

import { LuFolder, LuRefreshCcw } from "react-icons/lu";

const FundingStatus = ({isSuccessful}: {isSuccessful: boolean}) => {
  return (
    <div className="grid place-items-center min-h-full w-full">
        <section className="w-full max-w-[325px] flex flex-col items-center">
            <img alt="" className="w-[175px] h-[160] object-cover" src={isSuccessful ? SuccessIcon : FailedIcon} />
            <h1 className="font-medium text-2xl text-[#112929]">Transaction {isSuccessful ? "successful" : "failed"}</h1>
            <p className="md:text-xl font-medium text-center my-10">
                Your {formatAmount(10000)} virtual card funding {isSuccessful ? "is successful" : "failed"}.
            </p>
            <div className="flex flex-col items-center w-full gap-2">
                <CustomButton className="w-full text-center" href="/dashboard">Return to dashboard</CustomButton>
                {
                    isSuccessful ? (
                        <CustomButton href="/receipt?txnId=1" variant="primary" className="flex items-center justify-center gap-3 w-full md:border border-[#112929] font-medium text-[#112929] bg-transparent">
                            <LuFolder className="size-6" />
                            <span>Transaction details</span>
                        </CustomButton>
                    ) : (
                        <CustomButton href="/dashboard/virtual-card" variant="primary" className="flex items-center justify-center gap-3 w-full md:border border-[#112929] font-medium text-[#112929] bg-transparent">
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

export default FundingStatus