import BackButton from "@/components/Authentication/BackButton"
import CustomButton from "@/components/CustomButton"
import { cn } from "@/lib/utils"
import { CreateStaticAccountForm } from "@/lib/zodSchemas/dashboard.schema"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check } from "lucide-react"
import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

type TFormData = z.infer<typeof CreateStaticAccountForm>;

import CalenderIcon from "@/assets/dashboard/calendar.svg"
import { formatDate } from "date-fns"
import { useMutation } from "@tanstack/react-query"
import { validateIdentity, VerificationStatusResponse } from "@/lib/api/dashboard-apis/staticAccountApis"
import { AxiosError } from "axios"
import VerifyValidationOtp from "./VerifyValidationOtp"
const currentDate = new Date(Date.now());

const CreateStaticAccount = () => {
     const [dob, setDob] = useState<Date | null>(null);
     const [verifyError, setVerifyError] = useState<string | null>(null);
     const [showVerifyForm, setShowVerifyForm] = useState<boolean>(false);
     const [identityId, setIdentityId] = useState<string | null>(null);
    //  const {setAuthData, token} = useAuth();

     const inputRef = useRef<HTMLInputElement>(null);

    const handleOpenPicker = () => {
        if (inputRef.current) {
        inputRef.current.showPicker();
        }
    };

    const handleDatePicker = (value: Date) => {
        if(value  > currentDate ){
        toast.info("You can't select a day in the future");
        return
        }

        setDob(value)
    }

    const {mutate: verifyBvn, isPending: isVerifying} = useMutation({
        mutationFn: validateIdentity,
        onSuccess: (data: VerificationStatusResponse) => {
            (void 0)
            // setAuthData(data.data.user, token as string);
            setDob(null);
            setVerifyError(null);
            toast.info("An otp has been sent to the phone number linked with your bvn.")
            setIdentityId(data?.data?.identityId)
            setShowVerifyForm(true)
        },
        onError: (error: AxiosError) => {
            (void 0)
            const errData = error.response?.data as { message?: string };

            if(errData.message){
                return setVerifyError(errData.message)
            }
            toast.error("Something went wrong, please try again")
        }
    })

    const {
            register,
            formState: {errors},
            handleSubmit
    } = useForm<TFormData>({
        resolver: zodResolver(CreateStaticAccountForm)
    })

    const onSubmit = (data: TFormData) => {
        if(!dob){
            toast.error("Please select a date of birth")
            return
        }

        const firstname = data.fullname.split(" ")[0];
        const lastname = data.fullname.split(" ")[1] || "";
        const dateOfBirth = formatDate(dob, "yyyy-MM-dd");

        setVerifyError(null);
        verifyBvn({dateOfBirth: dateOfBirth, firstname: firstname, lastname: lastname, value: data.bvn});
    }

    if(showVerifyForm) return <VerifyValidationOtp
                                identityId={identityId}
                                setIdentityId={setIdentityId}
                                setShowVerifyForm={setShowVerifyForm} 
                                />

  return (
    <section className="w-full mx-auto max-md:self-start">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
          <BackButton icon href="/dashboard"/>
          <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Static acount</p>
        </div>

        <div className="max-md:hidden"> 
            <h1 className="text-[#112929] font-medium text-2xl">Create static account</h1>
            <p className="text-[#717171] mt-2">Enter the details below to create a static account</p>
        </div>
        {verifyError && <p className="text-red-500 text-sm mt-1">{verifyError}</p>}

        <form onSubmit={handleSubmit(onSubmit)} className="w-full mt-14 md:mt-8">
            <div className="w-full">
                <label className="text-sm text-[#344054] font-medium" htmlFor="fullname">Full name</label>
                <input {...register("fullname")} placeholder="enter your full name" className="w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="text" id="fullname" />
                {errors.fullname && <p className="text-red-500 text-sm mt-1">{errors.fullname.message}</p>}
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
                <label className="text-sm text-[#344054] font-medium" htmlFor="bvn">BVN</label>
                <input {...register("bvn")} placeholder="enter bank verification number" className="w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="text" id="bvn" />
                {errors.bvn && <p className="text-red-500 text-sm mt-1">{errors.bvn.message}</p>}
            </div>

            <div className="mt-3 flex items-start">
                <label className="cursor-pointer">
                    <input {...register("accept_terms")} type="checkbox" className="peer hidden" />
                    <div className="size-5 border border-[#D0D5DD] rounded-md transition-colors duration-200 flex items-center justify-center 
                                    peer-checked:bg-[#112929] peer-checked:[&>svg]:opacity-100">
                        <Check className="size-4 text-white opacity-0 transition-opacity duration-200" />
                    </div>
                </label>
                <p className="text-[#667085] text-sm ml-2">By clicking this, you are accepting our Terms & Condition</p>
            </div>
    
            <CustomButton disabled={isVerifying} isLoading={isVerifying} className="mt-10 w-full">Proceed - <span className="opacity-60">Verify BVN</span></CustomButton>
        </form>
    </section>
  )
}

export default CreateStaticAccount