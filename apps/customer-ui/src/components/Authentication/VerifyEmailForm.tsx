import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LoaderCircle } from "lucide-react";

import CustomButton from "@/components/CustomButton"
import { verifyEmailSchema } from "@/lib/zodSchemas/auth.schema";
import { TPasswordResetFormData } from "@/routes/auth-pages/ResetPassword";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { resendPasswordOtp } from "@/lib/api/authApi";
import { AxiosError } from "axios";

type TFormData = z.infer<typeof verifyEmailSchema>;

type TVerifyEmailForm = {
    showNewPasswordForm: () => void;
    setFormData: React.Dispatch<React.SetStateAction<TPasswordResetFormData>>
}

const VerifyEmailForm = ({showNewPasswordForm, setFormData}: TVerifyEmailForm ) => {
 
     const {
         register,
         watch,
         handleSubmit,
         trigger,
         formState: {errors}
     } = useForm<TFormData>({
         resolver: zodResolver(verifyEmailSchema)
     })

     const {mutate: resendOtp, isPending: isSendingOtp} = useMutation({
        mutationFn: resendPasswordOtp,
        onSuccess: () => {
            toast.success("If this email is registered and verified, a reset code will arrive shortly.")
        },
        onError: (error: AxiosError) => {
            const errData = error.response?.data as { message?: string };
                if(errData.message){
                    return toast.error(errData.message)
                }
            toast.error("Something went wrong, please try again")
        }
    })

    //  const {mutate: verifyOtp, isPending: isVerifying} = useMutation({
    //     mutationFn: verifyPasswordToken,
    //     onSuccess: (data) => {
    //         (void 0)
    //         toast.success("If this email is registered and verified, a reset code will arrive shortly.")
    //     },
    //     onError: (error: AxiosError) => {
    //         const errData = error.response?.data as { message?: string };
    //             if(errData.message){
    //                 return toast.error(errData.message)
    //             }
    //         toast.error("Something went wrong, please try again")
    //     }
    // })
 
     const emailInput = watch("email");
     
     const sendCode = async () => {
         const emailValid = await trigger("email");

         if (!emailInput || !emailValid) {
             toast.info("Please input a valid email")
             return
         }
         resendOtp(emailInput);
     }
 
     const onSubmit = (data: TFormData) => {
         void 0;
         setFormData(data)
        
         showNewPasswordForm();
     }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[410px] mt-8 md:mt-3">
        <div className="w-full md:mt-6">
            <label className="text-[#344054] text-sm font-medium mb-2" htmlFor="email">Email Address</label>
            <div className="relative">
                <input id="email" {...register("email")} type="email" placeholder="annaske@gmail.com" className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-sm placeholder:text-[#667085] rounded-md mt-1.5 focus:border-[#112929] transition" />
                {
                    isSendingOtp ? (
                        <LoaderCircle className="animate-spin size-4 text-[12008F] absolute top-1/3 right-3.5" />
                    ) : (
                        <button type="button" onClick={sendCode} className="cursor-pointer text-[#112929] text-sm absolute top-1/3 right-3.5 hover:opacity-80 transition">Send code</button>
                    )
                }
            </div>
            {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
        </div>
        <div className="w-full mt-5">
            <label className="text-[#344054] text-sm font-medium" htmlFor="reset-code">8-digit reset code</label>
            <input id="reset-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} {...register("code")} placeholder="00000000" className="w-full outline-0 bg-white py-2.5 px-3 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-2 focus:border-[#112929] transition" />
            {errors.code && <p className="text-red-600 text-sm mt-1">{errors.code.message}</p>}
        </div>
        <CustomButton className="w-full mt-6">Proceed - <span className="opacity-60">Set new password</span></CustomButton>
    </form>
  )
}

export default VerifyEmailForm