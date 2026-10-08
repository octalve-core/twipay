import CustomButton from "@/components/CustomButton"
import useEventsStore from "@/stores/useEventsStore";

import EventImage from "@/assets/dashboard/5ive.png"
import Clock from "@/assets/dashboard/clock-icon.svg"
import Site from "@/assets/dashboard/site-icon.svg"
import Location from "@/assets/dashboard/location-icon.svg"
import Tag from "@/assets/dashboard/tag-icon.svg"

const EventDetails = () => {
    const {update} = useEventsStore();

  return (
    <div className="hidden md:block w-full sticky top-0 h-[80vh] overflow-y-auto hide-scrollbar">
        <div className="flex items-center gap-[22px]">
            <img className="size-[137px] rounded-[10px] object-cover" src={EventImage} />
            <div className="">
                <h2 className="text-xl text-[#1C1B19] font-medium mb-3">5ive listening party</h2>
                <p className="text-sm text-[#667085]">Nearly 5,000 years after he was bestowed with the almighty powers of the ancient gods and imprisoned just as quickly.</p>
            </div>
        </div>
        <div className="mt-[30px]">
            <h3 className="text-lg text-[#1D2739] font-medium mb-3">Saturday, March 29th</h3>
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <img src={Clock} className="" />
                    <span className="text-sm text-[#475367]">11:30 AM - 12:30 PM</span>
                </div>
                <div className="flex items-center gap-3">
                    <img src={Site} className="" />
                    <span className="text-sm text-[#344054]">Partner@5ive.ng</span>
                </div>
                <div className="flex items-center gap-3">
                    <img src={Location} className="" />
                    <span className="text-sm text-[#475367]">Eko hotels and suite, Victoria island, Lagos.</span>
                </div>
                <div className="flex items-center gap-3">
                    <img src={Tag} className="" />
                    <span className="text-sm text-[#475367]">₦ 16,500.00</span>
                </div>
            </div>
        </div>

        <div className="w-full border-t-[2px] border-b-[2px] border-[#F0F2F5] mt-9 mb-8 py-8 flex flex-col gap-4">
            <div className="w-full flex items-center justify-between text-sm text-[#475367]">
                <p>Cost</p>
                <p>₦ 16,500.00</p>
            </div>
            <div className="w-full flex items-center justify-between text-sm text-[#475367]">
                <p>Tax (10%)</p>
                <p>₦ 16,500.00</p>
            </div>
            <div className="w-full flex items-center justify-between text-sm text-[#475367]">
                <p>Service  fee</p>
                <p>₦ 16,500.00</p>
            </div>
            <div className="w-full flex items-center justify-between text-sm text-[#475367]">
                <p>Sub Total</p>
                <p>₦ 16,500.00</p>
            </div>
        </div>
        <CustomButton onClick={() => update({step: 2})} className="w-full">Proceed - <span className="opacity-60">enter details</span></CustomButton>
    </div>
  )
}

export default EventDetails