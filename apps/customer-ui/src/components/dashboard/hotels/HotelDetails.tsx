import { useState } from "react";

import BackButton from "@/components/Authentication/BackButton";
import CustomButton from "@/components/CustomButton";
import CustomStarRating from "@/components/dashboard/custom-star-rating";
import HotelImages from "@/components/dashboard/hotels/HotelImages";
import { cn } from "@/lib/utils";

import { LuCarTaxiFront, LuUsers, LuWifi } from "react-icons/lu";
import { PiPawPrint } from "react-icons/pi";

const HotelDetails = () => {
    const [isExpanded, setIsExpanded] = useState(false); // For text clamping

  return (
        <section className=" w-full mx-auto text-[#344054] md:sticky top-0 md:h-[80vh] md:overflow-y-auto hide-scrollbar hidden md:block">
            <div className="flex items-center mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
              <BackButton icon href="/dashboard/hotels"/>
              <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Hotel booking</p>
            </div>

            {/* <div className="max-md:hidden">
                <h1 className="text-[#112929] text-2xl font-medium">Hotel booking</h1>
                <p className="text-[#717171] mt-2 mb-5">Please select the hotel you want to book</p>
            </div> */}

            <div className="flex flex-col max-md:mt-14">
                <section>
                    <div className="flex items-center gap-7">
                        <h2 className="text-xl md:text-2xl font-medium">Eko hotels and suite</h2>
                        <div className="flex items-center gap-1">
                            <CustomStarRating rating={5} small readonly />
                            <span className="font-medium text-xs md:text-sm">4.98</span>
                        </div>
                    </div>

                    <p className="text-sm mt-1 md:mt-2">23A - 45A Asap rd, High Way, Victoria Island, Lagos.</p>

                    <div className="flex items-center gap-3 my-5">
                        <div className="bg-[#1129290D] rounded-sm px-7 py-2.5">
                            <span className="font-bold text-xl md:text-2xl">₦ 214,890</span>
                            <span className="md:text-xl"> /night</span>
                        </div>

                        <div className="flex items-center gap-1 ">
                            <LuUsers className="size-5" />
                            <span>2 guests</span>
                        </div>
                    </div>
                </section>

                <HotelImages />

                <section>
                    <div className="">
                        <h3 className="text-sm md:text-lg font-medium mb-2 md:mb-3">Property description</h3>
                        <p className={cn("text-xs md:text-base", !isExpanded && "line-clamp-2")}>
                            The famous Eko hotel Hotel is a modern, elegant 4-star hotel overlooking the road, a charming vacation, 
                            in the enchanting setting of Taormina and the Ionian, located in the heart of Victoria Island, located in the heart of Victoria Island.
                        </p>
                        <button onClick={() => setIsExpanded(prev => !prev)} className="text-[#112929] cursor-pointer inline text-sm">{isExpanded ? "read less" : "read more"}</button>
                    </div>

                    <div className="mt-7 md:mt-8">
                        <h4 className="font-medium text-sm md:text-lg mb-4">Main facilities</h4>
                        <div className="flex flex-wrap justify-between gap-9">
                            <div className="flex items-center gap-1">
                                <LuWifi className="size-3.5 md:size-4" />
                                <span className="text-xs md:text-sm">5G Wifi</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <LuCarTaxiFront className="size-3.5 md:size-4" />
                                <span className="text-xs md:text-sm">Free car park</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <PiPawPrint className="size-3.5 md:size-4" />
                                <span className="text-xs md:text-sm">Pet friendly</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full max-w-[410px] mx-auto mt-8">
                        <CustomButton href="/dashboard/hotels/1/customer-info" className="w-full inline-block text-center">Proceed - <span className="opacity-60">book hotel</span></CustomButton>
                    </div>
                </section>
            </div>
        </section>
  )
}

export default HotelDetails