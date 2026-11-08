import { Control, Controller, FieldErrors, UseFormRegister } from "react-hook-form"

import { LuUser } from "react-icons/lu";
import CalenderIcon from "@/assets/dashboard/calendar.svg"

import PhoneInput from "react-phone-input-2";

import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { TFormData } from "./CustomerInfoForm";
import { toast } from "sonner";
import useHotelsStore from "@/stores/useHotelsStore";

type TInfoFormStepOne = {
    register: UseFormRegister<TFormData>;
    errors: FieldErrors<TFormData>;
    control: Control<TFormData>;
}

const currentDate = new Date(Date.now());

const InfoFormStepOne = ({register, errors, control}: TInfoFormStepOne) => {
    const {dob, update} = useHotelsStore()
    const [isFocused, setIsFocused] = useState(false);

      const inputRef = useRef<HTMLInputElement>(null);
    
      const handleOpenPicker = () => {
        if (inputRef.current) {
          inputRef.current.showPicker(); // programmatically open the date picker
        }
      };

    const handleDatePicker = (value: Date) => {
        if(value  > currentDate ){
          toast.info("You can't select a day in the future");
          return
        }

        update({dob: value})
    }     

  return (
        <div className="">
                <div className="w-full">
                    <label className="text-sm text-[#344054] font-medium" htmlFor="firstname">First name</label>
                    <div className="w-full h-fit relative mt-1.5">
                        <input {...register("firstname")} placeholder="enter your first name" className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" id="firstname" />
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2"><LuUser className="text-[#667085] size-5" /></span>
                    </div>
                    {errors.firstname && <p className="text-red-600 text-sm mt-1">{errors.firstname.message}</p>}
                </div>

                <div className="w-full mt-5">
                    <label className="text-sm text-[#344054] font-medium" htmlFor="middlename">Middle name</label>
                    <div className="w-full h-fit relative mt-1.5">
                        <input {...register("middlename")} placeholder="enter your middle name" className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" id="middlename" />
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2"><LuUser className="text-[#667085] size-5" /></span>
                    </div>
                    {errors.middlename && <p className="text-red-600 text-sm mt-1">{errors.middlename.message}</p>}
                </div>

                <div className="w-full mt-5">
                    <label className="text-sm text-[#344054] font-medium" htmlFor="lastname">Last name</label>
                    <div className="w-full h-fit relative mt-1.5">
                        <input {...register("lastname")} placeholder="enter your last name" className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" id="lastname" />
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2"><LuUser className="text-[#667085] size-5" /></span>
                    </div>
                    {errors.lastname && <p className="text-red-600 text-sm mt-1">{errors.lastname.message}</p>}
                </div>

                <div className="w-full flex flex-col mt-5">
                <label className="text-sm text-[#344054] font-medium mb-1.5" htmlFor="departure-date">Date of birth</label>
                        <div
                            onClick={handleOpenPicker}
                            className={cn(
                            "w-full h-12 cursor-pointer flex items-center px-3.5 justify-between text-sm font-normal border-[0.5px] border-[#D0D5DD] rounded-lg bg-white outline-none focus-within:border-[#112929]",
                            !dob && "text-[#667085]"
                            )}
                        >
                            <input
                            ref={inputRef}
                            type="date"
                            onKeyDown={(e) => e.preventDefault()} // Prevent typing
                            value={dob ? dob.toISOString().split('T')[0] : ''}
                            onChange={(e) => handleDatePicker(new Date(e.target.value))}
                            placeholder="Pick a date"
                            className="bg-transparent cursor-pointer outline-none border-none flex-1 placeholder:text-[#667085] text-sm font-normal"
                            />
                            <img className="size-[22px] cursor-pointer" src={CalenderIcon} alt="Calendar Icon" />
                        </div>
                </div>

                <div className="w-full mt-5">
                    <label className="text-[#344054] text-sm font-medium mb-2" htmlFor="lastname">Phone number</label>
                    <Controller
                        name="phone"
                        control={control}
                        render={({field}) => (
                            <PhoneInput
                                country={'ng'}
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="phone number"
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => {
                                    setIsFocused(false)
                                    field.onBlur()}
                                }
                                inputProps={{
                                    name: "phone",
                                    // required: true,
                                }}
                                buttonStyle={{ 
                                    borderRadius: "8px 0 0 8px",
                                     border: isFocused ? ".5px solid #112929" : "1px solid #D0D5DD",
                                    background: "#FFFFFF",
                                }}
                                inputStyle={{
                                    width: "100%",
                                    outline: "0",
                                    background: "#FFFFFF",
                                    height: "44px",
                                    border: isFocused ? "1px solid #112929" : "1px solid #D0D5DD",
                                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04)",
                                    borderRadius: "8px",
                                    color: "#344054",
                                }}
                            />
                                        
                        )}
                    />
                    {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone.message}</p>}
                </div>
            </div>
  )
}

export default InfoFormStepOne