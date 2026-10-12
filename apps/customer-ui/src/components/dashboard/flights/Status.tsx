import SuccessIcon from "@/assets/dashboard/success_icon.svg";
import FailedIcon from "@/assets/dashboard/fail_icon.svg";
import CustomButton from "@/components/CustomButton";
import {  LuRefreshCcw } from "react-icons/lu";
import { formatAmount } from "@/lib/utils";
import useFlightStore from "@/stores/useFlightStore";

const Status = () => {
    const {bookedFlightId, fromLocation, toLocation, selectedAirline} = useFlightStore();

  return (
    <div className="grid place-items-center min-h-full w-full">
        <section className="w-full max-w-[325px] flex flex-col items-center">
            <img className="w-[175px] h-[160] object-cover" src={bookedFlightId ? SuccessIcon : FailedIcon} />
            <h1 className="font-medium text-2xl text-[#112929]">Transaction {bookedFlightId ? "successful" : "failed"}</h1>
            <p className="md:text-xl font-medium text-center my-10">
                Your one way flight ticket booking from {fromLocation?.name} to {toLocation?.name} for {formatAmount(parseInt(selectedAirline?.price as string))} {bookedFlightId ? "is successful" : "failed"}.
            </p>
            <div className="flex flex-col items-center w-full gap-2">
                <CustomButton className="w-full text-center" href="/dashboard">Return to dashboard</CustomButton>
                <CustomButton href="/dashboard/book-flight" variant="primary" className="flex items-center justify-center gap-3 w-full md:border border-[#112929] font-medium text-[#112929] bg-transparent">
                    <LuRefreshCcw className="size-6" />
                    <span>Try again</span>
                </CustomButton>
                {/* {
                    bookedFlightId ? (
                        <CustomButton href="/receipt?txnId=1" variant="primary" className="flex items-center justify-center gap-3 w-full md:border border-[#112929] font-medium text-[#112929] bg-transparent">
                            <LuFolder className="size-6" />
                            <span>Transaction details</span>
                        </CustomButton>
                    ) : (
                        <CustomButton href="/dashboard/book-flight" variant="primary" className="flex items-center justify-center gap-3 w-full md:border border-[#112929] font-medium text-[#112929] bg-transparent">
                            <LuRefreshCcw className="size-6" />
                            <span>Try again</span>
                        </CustomButton>
                    )
                } */}
            </div>
        </section>
    </div>
  )
}

export default Status