import { useSearchParams } from "react-router-dom";

import SuccessIcon from "@/assets/dashboard/success_icon.svg";
import FailedIcon from "@/assets/dashboard/fail_icon.svg";
import CustomButton from "@/components/CustomButton";
import { LuFolder, LuRefreshCcw } from "react-icons/lu";

const Status = () => {
// get txnId from the url and fetch transaction from database to determin what component renders - either success of failed based on the status from database data

    const [searchParams] = useSearchParams();
    const txnId = searchParams.get("txnId");
    (void 0)

    const isSuccessful = true;

  return (
    <div className="grid place-items-center min-h-full w-full">
        <section className="w-full max-w-[596px] flex flex-col items-center">
            <img src={isSuccessful ? SuccessIcon : FailedIcon} />
            <h1 className="font-medium text-2xl text-[#112929]">Transaction {isSuccessful ? "successful" : "failed"}</h1>
            <p className="md:text-[28px] md:leading-10 text-center mt-3 mb-12 md:mt-12 md:mb-12">Your transfer of ₦ <span className="font-medium">100,000</span> to <span className="font-medium">0000000000 (Anna Keshinro)</span> {isSuccessful ? "is successful" : "failed"}.</p>
            <div className="flex flex-col md:flex-row items-center w-full gap-2 md:gap-5">
                <CustomButton className="w-full text-center" href="/dashboard">Return to dashboard</CustomButton>
                {
                    isSuccessful ? (
                        <CustomButton href="/receipt" variant="primary" className="flex items-center justify-center gap-3 w-full md:border border-[#112929] font-medium text-[#112929] bg-transparent">
                            <LuFolder className="size-6" />
                            <span>Transaction details</span>
                        </CustomButton>
                    ) : (
                        <CustomButton href="/dashboard" variant="primary" className="flex items-center justify-center gap-3 w-full md:border border-[#112929] font-medium text-[#112929] bg-transparent">
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