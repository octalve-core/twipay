import { LuFolder, LuRefreshCcw } from "react-icons/lu";

import CustomButton from "@/components/CustomButton";
import { formatAmount } from "@/lib/utils";
import SuccessIcon from "@/assets/dashboard/success_icon.svg";
import FailedIcon from "@/assets/dashboard/fail_icon.svg";
import useEpinStore from "@/stores/useEPinStore";

const Status = () => {
    const {txnResult, reset, selectedProduct} = useEpinStore();

  return (
    <div className="grid place-items-center min-h-full w-full">
        <section className="w-full max-w-[325px] flex flex-col items-center">
            <img className="h-[113px] w-[124px] md:w-[175px] md:h-[160px] object-cover" src={txnResult ? SuccessIcon : FailedIcon} />
            <h1 className="font-medium text-2xl text-[#112929] mt-2">Transaction {txnResult ? "successful" : "failed"}</h1>
            <p className="md:text-xl text-center mt-3 mb-12 md:my-10 max-md:text-[#717171]">
            Your purchase of <span className="font-medium">{selectedProduct?.name}</span> for <span className="font-medium">{formatAmount(selectedProduct?.amount as number)}</span> {txnResult ? "is successful" : "failed"}.
            </p>
            <div className="flex flex-col items-center w-full gap-2">
                <CustomButton className="w-full text-center" href="/dashboard">Return to dashboard</CustomButton>
                {
                    txnResult ? (
                        <CustomButton href={`/receipt?txnId=${txnResult.result.reference}`} variant="primary" className="flex items-center justify-center gap-3 w-full md:border border-[#112929] font-medium text-[#112929] bg-transparent">
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