import { Controller } from "react-hook-form"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"

import { LuUser } from "react-icons/lu";
import CalenderIcon from "@/assets/dashboard/calendar.svg"

import PhoneInput, { CountryData } from "react-phone-input-2";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { PassengerInfoFormSchema } from "@/lib/zodSchemas/dashboard.schema";
import { z } from "zod";
import CustomButton from "@/components/CustomButton";
import useFlightStore, { PassengerFormData } from "@/stores/useFlightStore";
import { Passenger } from "@/lib/api/dashboard-apis/flightApis";
import BackButton from "@/components/Authentication/BackButton";
import { useNavigate } from "react-router-dom";

type TPassengerInfo = {
    setShowDocumentForm: React.Dispatch<React.SetStateAction<boolean>>;

    index: number;
    passenger: Passenger;
    onNext: (passengerFormData: PassengerFormData) => void;
};

type TFormData = z.infer<typeof PassengerInfoFormSchema>;

const currentDate = new Date(Date.now());

const PassengerInfoForm = ({setShowDocumentForm, onNext, index, passenger}: TPassengerInfo) => {
    const [isFocused, setIsFocused] = useState(false);

    const [dob, setDob] = useState<Date | null>(null);
    const [dialCode, setDialCode] = useState("");
    const [localPhone, setLocalPhone] = useState("");

    const navigate = useNavigate()
    const inputRef = useRef<HTMLInputElement>(null);

    const {selectedAirline, updatePassenger, currentStep, setCurrentStep} = useFlightStore();
    void 0;
    const isFirstAdult = ( passenger.type === "adult" && passenger.id === "1");

    const handleOpenPicker = () => {
    if (inputRef.current) {
        inputRef.current.showPicker(); // programmatically open the date picker
    }
    };
    const handleDatePicker = (value: Date) => {
        const minAdultDob = new Date(
            currentDate.getFullYear() - 12,
            currentDate.getMonth(),
            currentDate.getDate()
        );
        const maxChildDob = new Date(
            currentDate.getFullYear() - 11,
            currentDate.getMonth(),
            currentDate.getDate()
        );
        const minInfantDob = new Date(
            currentDate.getFullYear() - 3,
            currentDate.getMonth(),
            currentDate.getDate()
        );

        void 0;

        const isAdult = value  < minAdultDob;
        const isChild = value < minInfantDob && value > maxChildDob;
        const isInfant = value >= minInfantDob;

        if(value  > currentDate ){
          toast.info("You can't select a day in the future");
          return
        }

        if(passenger.type === "adult" && !isAdult){
          toast.info("An adult should be 12 years or older");
          return
        }

        if(passenger.type === "child" && !isChild){
          toast.info("A child should be between 3 and 11 years old");
          return
        }

        if(passenger.type === "held_infant" && !isInfant){
          toast.info("An infant should be 3 years or below");
          return
        }

        setDob(value)
    }

    const {
        register,
        formState: {errors},
        handleSubmit,
        control,
    } =  useForm<TFormData>({
        resolver: zodResolver(PassengerInfoFormSchema),
        mode: "onTouched",
    });
    
    const onSubmit = (data: TFormData) => {
        if(!dob) return

        if(isFirstAdult) {
            updatePassenger(currentStep, {
                id: passenger.id,
                type: passenger.type,
                dob: dob?.toISOString().split("T")[0],
                email: data.email,
                firstname: data.firstname,
                gender: data.gender,
                lastname: data.lastname,
                phone: localPhone,
                phone_code: dialCode
            })
            setShowDocumentForm(true);
        } else {
            onNext({
                id: passenger.id,
                type: passenger.type,
                dob: dob?.toISOString().split("T")[0],
                email: data.email,
                firstname: data.firstname,
                gender: data.gender,
                lastname: data.lastname,
                phone: localPhone,
                phone_code: dialCode
            })
        }
    }

    const getBackBtnAction = () => {
        if(isFirstAdult){
            navigate(`/dashboard/airline/${selectedAirline?.id}`)
        } else {
            setCurrentStep(currentStep -1)
        }
    }

  return (
        <div onSubmit={handleSubmit(onSubmit)} className="flex max-md:flex-col md:items-start md:gap-[18px] w-full">
            <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
                <BackButton icon action={() => getBackBtnAction()}/>
                <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Passenger info {index + 1} - <span className="capitalize">{passenger.type.replace("_", " ") ?? ""} </span></p>
            </div>

            <p className="text-[#344054] text-center md:hidden mt-14">Kindly enter your flight details below.</p>

            <BackButton className="max-md:hidden" action={() => getBackBtnAction()} />
            <form className="flex max-md:flex-col gap-5 md:gap-[100px] w-full">
                <div className="w-full">
                    <div className="mb-8 max-md:hidden">
                        <h1 className="text-[#112929] text-2xl font-medium">Passenger info {index + 1} - <span className="capitalize">{passenger.type.replace("_", " ") ?? ""} </span></h1>
                        <p className="mt-2 text-[#717171]">Please enter passenger information</p>
                    </div>

                    <div className="mt-8 flex flex-col gap-5">
                        <div className="w-full">
                            <label className="text-sm text-[#344054] font-medium" htmlFor="firstname">First name</label>
                            <div className="w-full h-fit relative mt-1.5">
                                <input {...register("firstname")} placeholder="enter your first name" className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" id="firstname" />
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2"><LuUser className="text-[#667085] size-5" /></span>
                            </div>
                            {errors.firstname && <p className="text-red-500 text-sm mt-1">{errors.firstname.message}</p>}
                        </div>
                        <div className="w-full">
                            <label className="text-sm text-[#344054] font-medium" htmlFor="lastname">Last name</label>
                            <div className="w-full h-fit relative mt-1.5">
                                <input {...register("lastname")} placeholder="enter your last name" className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" id="lastname" />
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2"><LuUser className="text-[#667085] size-5" /></span>
                            </div>
                            {errors.lastname && <p className="text-red-500 text-sm mt-1">{errors.lastname.message}</p>}
                        </div>
                        <div className="w-full flex flex-col ">
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
                        <div className="w-full ">
                            <label className="text-[#344054] text-sm font-medium mb-2" htmlFor="lastname">Phone number</label>
                            <Controller
                                name="phone"
                                control={control}
                                render={({field}) => (
                                    <PhoneInput
                                        country={'ng'}
                                        value={field.value}
                                        onChange={(value, data: CountryData) => {
                                            field.onChange(value);
                                            setDialCode("+"+data.dialCode);
                                            setLocalPhone(value.replace(data.dialCode, ""))
                                        }}
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
                            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
                        </div>
                    </div>
                </div>

                <div className="h-[80vh] w-[1px] self-start bg-[#6670854D] sticky top-0 hidden md:block" />

                <div className="w-full">
                        <div className="mb-8 max-md:hidden">
                            <h1 className="text-[#112929] text-2xl font-medium">Passenger info {index + 1} - <span>{passenger.type.replace("_", " ") ?? ""} </span></h1>
                            <p className="mt-2 text-[#717171]">Please enter passenger information</p>
                        </div>

                        <div className="flex flex-col gap-5 md:mt-8">
                            <div className="w-full ">
                                <label className="text-[#344054] text-sm font-medium" htmlFor="email">Email address</label>
                                <input id="email" {...register("email")} type="email" placeholder="Enter your email address" className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-sm placeholder:text-[#667085] rounded-md mt-1.5 focus:border-[#112929] transition" />
                                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
                            </div>
                        <Controller
                            name="gender"
                            control={control}
                            rules={{ required: true}}
                            render={({field}) => (
                                <div className=" w-full">
                                    <label className="text-[#344054] text-sm font-medium" htmlFor="gender">Gender</label>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="w-full py-3 !h-12 mt-2 px-3.5 border !bg-white border-[#D0D5DD] shadow-[#1018280D]">
                                            <SelectValue placeholder="Select gender" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white outline-0">
                                            <SelectItem value="male">Male</SelectItem>
                                            <SelectItem value="female">Female</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        />
                        <CustomButton disabled={!dob} className="w-full mt-8">Proceed {isFirstAdult && <span className="opacity-60">- Document info</span>}</CustomButton>
                    </div>
                </div>
            </form>
        </div>
    )
}

export default PassengerInfoForm