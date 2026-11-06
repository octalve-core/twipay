import MastercardIcon from "@/assets/dashboard/Mastercard.png"
import PayPass from "@/assets/dashboard/PayPass icon.png"

const Card = () => {
  return (
    <div className="mt-16 md:mt-8 w-full h-[180px] md:h-[206px] grid grid-cols-4 rounded-lg overflow-hidden text-white relative">
        <div className="col-span-3 bg-[#344054] p-5 flex flex-col justify-between">
            <h3 className="text-lg md:text-2xl font-bold">₦ 1,650,000</h3>

            <div className="flex justify-between items-end w-full">
                <div className="flex flex-col gap-2 w-full">
                    <div className="flex max-md:justify-between w-full items-center gap-16">
                        <h4 className="text-xs uppercase font-medium tracking-widest">OLIVIA RHYE</h4>
                        <span className="text-xs font-medium">06/24</span>
                    </div>
                    <p className="text-sm md:text-base font-medium tracking-widest">1234 1234 1234 1234</p>
                </div>
                <div className="w-[45px] h-8 grid place-items-center bg-white/10 absolute right-[19%] bottom-8 z-10">
                    <img alt="" src={MastercardIcon} className="object-cover w-7 h-4" />
                </div>
            </div>
        </div>
        <div className="col-span-1 bg-gradient-to-b from-purple-400 to-red-300 relative">
            <img alt="" src={PayPass} className="2-4 md:w-5 hh-5 md:h-6 absolute top-4 right-4" />
        </div>
    </div>
  )
}

export default Card