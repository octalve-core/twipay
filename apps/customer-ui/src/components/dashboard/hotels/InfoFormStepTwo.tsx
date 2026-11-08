
import { FieldErrors, UseFormRegister } from "react-hook-form";
import { TFormData } from "./CustomerInfoForm";
import { useRef } from "react";

import CalenderIcon from "@/assets/dashboard/calendar.svg"
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import useHotelsStore from "@/stores/useHotelsStore";

  type TInfoFormStepTwo = {
    register: UseFormRegister<TFormData>;
    errors: FieldErrors<TFormData>;
  }

  const ONE_DAY = 24 * 60 * 60 * 1000
  const currentDate = new Date(Date.now() - ONE_DAY);

const InfoFormStepTwo = ({ errors, register}: TInfoFormStepTwo) => {
    const {checkin, checkout, update} = useHotelsStore();

    const checkinInputRef = useRef<HTMLInputElement>(null);
    const checkoutInputRef = useRef<HTMLInputElement>(null);

        const getNumberOfNights = () => {
            if (!checkin || !checkout) return '';
    
            const millisecondsPerDay = 1000 * 60 * 60 * 24;
            const diffInMilliseconds = checkout.getTime() - checkin.getTime();
            const nights = Math.floor(diffInMilliseconds / millisecondsPerDay);
            
            return  nights > 0 ? `${nights} night${nights > 1 ? 's' : ''}` : '';
          };
          const noOfNights = getNumberOfNights();
  
    const handleOpenPicker = (inputRef: React.RefObject<HTMLInputElement | null>) => {
      if (inputRef.current) {
        inputRef.current.showPicker(); // programmatically open the date picker
      }
    };

      const handleDatePicker = (value: Date, type: "checkin" | "checkout") => {
        if(value < currentDate ){
          toast.info("You can't select a day in the past");
          return
        }
        
        if(type === "checkin"){
          if(checkout && (checkout) < value ){
            toast.info("Your checkin date cannot come after your checkout date!");
            return
          }
    
          update({checkin: value});
        }
    
        if(type === "checkout"){
          if(checkin && checkin > value ){
            toast.info("Your checkout date cannot be before your checkin date!");
            return
          }
    
          update({checkout: value});
        }
      }

  return (
      <div className="mt-5 md:mt-0">
        <div className="w-full flex flex-col mt-5">
            <label className="text-sm text-[#344054] font-medium mb-1.5" htmlFor="departure-date">Check In</label>
            <div
                onClick={() => handleOpenPicker(checkinInputRef)}
                className={cn(
                "w-full h-12 cursor-pointer flex items-center px-3.5 justify-between text-sm font-normal border-[0.5px] border-[#D0D5DD] rounded-lg bg-white outline-none focus-within:border-[#112929]",
                !checkin && "text-[#667085]"
                )}
            >
                <input
                  ref={checkinInputRef}
                  type="date"
                  onKeyDown={(e) => e.preventDefault()} // Prevent typing
                  value={checkin ? checkin.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleDatePicker(new Date(e.target.value), "checkin")}
                  placeholder="Pick a date"
                  className="bg-transparent cursor-pointer outline-none border-none flex-1 placeholder:text-[#667085] text-sm font-normal"
                />
                <img className="size-[22px] cursor-pointer" src={CalenderIcon} alt="Calendar Icon" />
            </div>
        </div>

        <div className="w-full flex flex-col mt-5">
            <label className="text-sm text-[#344054] font-medium mb-1.5" htmlFor="departure-date">Check out</label>
            <div
                onClick={() => handleOpenPicker(checkoutInputRef)}
                className={cn(
                "w-full h-12 cursor-pointer flex items-center px-3.5 justify-between text-sm font-normal border-[0.5px] border-[#D0D5DD] rounded-lg bg-white outline-none focus-within:border-[#112929]",
                !checkout && "text-[#667085]"
                )}
            >
                <input
                  ref={checkoutInputRef}
                  type="date"
                  onKeyDown={(e) => e.preventDefault()} // Prevent typing
                  value={checkout ? checkout.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleDatePicker(new Date(e.target.value), "checkout")}
                  placeholder="Pick a date"
                  className="bg-transparent cursor-pointer outline-none border-none flex-1 placeholder:text-[#667085] text-sm font-normal"
                />
                <img className="size-[22px] cursor-pointer" src={CalenderIcon} alt="Calendar Icon" />
            </div>
        </div>

        <div className="w-full mt-5">
            <label className="text-[#344054] text-sm font-medium" htmlFor="postalcode">Duration of stay</label>
            <input disabled value={noOfNights} className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] text-[#667085] text-sm rounded-md mt-1.5 focus:border-[#112929] transition" />
        </div>  

        <div className="w-full mt-5">
            <label className="text-[#344054] text-sm font-medium" htmlFor="note">Additonal note <span className="font-normal">(optional)</span></label>
            <textarea id="note" {...register("note")} placeholder="Enter a note..." className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-1.5 focus:border-[#112929] transition" />
            {errors.note && <p className="text-red-600 text-sm mt-1">{errors.note.message}</p>}
        </div>
    </div>
  )
}

export default InfoFormStepTwo