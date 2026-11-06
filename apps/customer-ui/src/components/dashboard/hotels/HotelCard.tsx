import CustomButton from "@/components/CustomButton";
import { CiLocationOn } from "react-icons/ci";
import CustomStarRating from "../custom-star-rating";

const HotelCard = () => {
  return (
    <div className="col-span-full md:col-span-1 rounded-lg bg-white p-4 cursor-pointer border border-transparent hover:border-[#112929] transition">
        <div className="flex gap-2 items-center">
            <img alt="" className="size-3.5 object-cover rounded-full" />
            <h1 className="text-[#344054] font-medium">Eko hotels and suite</h1>
            <CustomStarRating starColor="#FFD700" readonly rating={5} small className="ml-auto" />
        </div>

        <div className="mb-2 flex items-center gap-2 text-[#344054]">
            <CiLocationOn className="size-4 opacity-60" />
            <p className="text-xs">High Way, Victoria Island, Lagos.</p>
            <p className="font-bold ml-auto">₦ 214, 890</p>
        </div>

        <div className="flex items-center">
            <CustomButton href="/dashboard/hotels/1/customer-info" className="flex items-center justify-center text-sm p-0 w-[127px] h-[37px] rounded-sm md:bg-[#ECEAFF]/40 border border-[#11292966]/50 hover:border-[#1570EF] md:text-[#112929] font-medium">Book hotel</CustomButton>
            <CustomButton className="flex items-center text-xs text-[#112929] py-0 px-3 h-[37px]" variant="primary">View details</CustomButton>
        </div>
    </div>
  )
}

export default HotelCard