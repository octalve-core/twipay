import { createNewPasswordFormSchema } from "@/lib/zodSchemas/auth.schema"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import CustomButton from "../CustomButton";

import RadioIcon from "@/assets/auth/radio-icon.png"
import { getPasswordConditions, getStrengthColor, getStrengthScore } from "@/lib/passwordStrengthChecker";
import { useState } from "react";
import { IoEyeOffOutline, IoEyeOutline } from "react-icons/io5";
import { TPasswordResetFormData } from "@/routes/auth-pages/ResetPassword";
import { useMutation } from "@tanstack/react-query";
import { setNewPassword } from "@/lib/api/authApi";
import { toast } from "sonner";
import { AxiosError } from "axios";

type TFormData = z.infer<typeof createNewPasswordFormSchema>;
type TCreateNewPasswordForm = {
    showPasswordResetSuccessMessage: () => void;
    formData: TPasswordResetFormData;
}

const CreateNewPasswordForm = ({showPasswordResetSuccessMessage, formData}: TCreateNewPasswordForm) => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
         const {
             register,
             handleSubmit,
             watch,
             formState: {errors}
         } = useForm<TFormData>({
             resolver: zodResolver(createNewPasswordFormSchema)
         }) 

         const password = watch("password");

         const conditions = getPasswordConditions(password);
         const score = getStrengthScore(conditions);
         const color = getStrengthColor(score);

        const {mutate, isPending: isResetting} = useMutation({
            mutationFn: setNewPassword,
            onSuccess: (data) => {
                (void 0)
                toast.success(data.message)
                showPasswordResetSuccessMessage()
            },
            onError: (error: AxiosError) => {
                const errData = error.response?.data as { message?: string };
                    if(errData.message){
                        return toast.error(errData.message)
                    }
                toast.error("Something went wrong, please try again")
            }
        })
     
         const onSubmit = (data: TFormData) => {
            (void 0)
            mutate({email: formData.email, token: formData.code, password: data.password})
         }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[410px] mt-8 md:mt-3">
        <div className="w-full mt-5">
            <label className="text-sm text-[#344054] font-medium" htmlFor="password">Password</label>
            <div className="w-full h-fit relative mt-1.5">
                <input {...register("password")} placeholder="Range" className="w-full border-[0.5px] border-[#D0D5DD] rounded-md py-2.5 px-3.5 pr-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type={showPassword ? "text" : "password"} id="password" />
                <button onClick={() => setShowPassword(prev => !prev)} type="button" className="absolute cursor-pointer text-[#98A2B3] right-3.5 top-1/2 -translate-y-1/2">
                    {showPassword ? <IoEyeOffOutline /> : <IoEyeOutline />}
                </button>
            </div>
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
        </div>      
        <div className="w-full mt-5">
            <label className="text-sm text-[#344054] font-medium" htmlFor="confirmPassword">Confirm Password</label>
            <div className="w-full h-fit relative mt-1.5">
                <input {...register("confirmPassword")} placeholder="Range" className="w-full border-[0.5px] border-[#D0D5DD] rounded-md py-2.5 px-3.5 pr-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type={showConfirmPassword ? "text" : "password"} id="confirmPassword" />
                <button onClick={() => setShowConfirmPassword(prev => !prev)} type="button" className="absolute cursor-pointer text-[#98A2B3] right-3.5 top-1/2 -translate-y-1/2">
                    {showConfirmPassword ? <IoEyeOffOutline /> : <IoEyeOutline />}
                </button>
            </div>
            {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>}
        </div>      

        {/* password strength checker */}
        <div className="flex flex-col mt-2.5">
            {/* progress bar */}
            <h3 className="text-sm text-[#667085] font-medium">Password Strength</h3>
            <div className="h-2 rounded-full overflow-hidden bg-[#FFFBFA] my-2.5">
                <div 
                    style={{
                        width: `${score/2 * 100}%`,
                        backgroundColor: color
                    }}
                    className="h-full rounded-full transition-all duration-300 ease-in-out" 
                />
            </div>
            <ul className="flex flex-col gap-2">
                <li className="flex items-center gap-3">
                    {conditions.minLength ? (
                    <img src={RadioIcon} className="object-cover size-4" />
                    ) : (
                    <div className="size-4 border border-[#E1E1E1] rounded-full" />
                    )}
                    <span className="text-[#667085] text-xs">Minimum of 8 characters</span>
                </li>
                <li className="flex items-center gap-3">
                    {conditions.hasUppercase ? (
                    <img src={RadioIcon} className="object-cover size-4" />
                    ) : (
                    <div className="size-4 border border-[#E1E1E1] rounded-full" />
                    )}
                    <span className="text-[#667085] text-xs">One UPPERCASE character</span>
                </li>
            </ul>

        </div>

        <CustomButton isLoading={isResetting} disabled={isResetting} className="w-full mt-6">Reset password</CustomButton>       
    </form>
  )
}

export default CreateNewPasswordForm
