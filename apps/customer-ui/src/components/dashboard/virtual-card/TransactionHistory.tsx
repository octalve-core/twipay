import { Link } from "react-router-dom";
import Icon from "@/assets/dashboard/transfer.png"

const TransactionDetails = () => {
  return (
    <div className="w-full max-w-[596px] mx-auto mt-14 md:mt-12">
        <div className="flex items-center justify-between">
            <h2 className="font-medium text-[#31373DE5] ">Transaction History</h2>
            <Link to="/dashboard" className="max-md:text-xs text-[#1C1C1CCC] hover:opacity-70 transition">See all</Link>
        </div>

        <div className="mt-3 w-full flex flex-col gap-2">
            <div className="bg-white p-2 rounded-lg flex justify-between border border-transparent hover:border-[#464E60] transition">
                <div className="flex items-center gap-2">
                    <div className="grid place-items-center size-[36px] md:size-10 bg-[#F8F8F8] rounded-full">
                        <img className="size-[18px] md:size-4 object-center" src={Icon} />
                    </div>
                    <div>
                        <h3 className="text-[#1C1C1CCC] text-sm font-medium">Google purchase</h3>
                        <p className="text-xs text-[#1C1C1C99]">23 march, 2024 09:12 PM</p>
                    </div>
                </div>

                <div className="text-sm text-right">
                    <p className="text-[#667085] font-medium">₦5,000</p>
                    <p className="text-[#008000]">Success</p>
                </div>
            </div>
            <div className="bg-white p-2 rounded-lg flex justify-between border border-transparent hover:border-[#464E60] transition">
                <div className="flex items-center gap-2">
                    <div className="grid place-items-center size-[36px] md:size-10 bg-[#F8F8F8] rounded-full">
                        <img className="size-[18px] md:size-4 object-center" src={Icon} />
                    </div>
                    <div>
                        <h3 className="text-[#1C1C1CCC] text-sm font-medium">Google purchase</h3>
                        <p className="text-xs text-[#1C1C1C99]">23 march, 2024 09:12 PM</p>
                    </div>
                </div>

                <div className="text-sm text-right">
                    <p className="text-[#667085] font-medium">₦5,000</p>
                    <p className="text-[#008000]">Success</p>
                </div>
            </div>

        </div>
    </div>
  )
}

export default TransactionDetails