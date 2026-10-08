import { ChangePasswordFormSchema } from "@/lib/zodSchemas/dashboard.schema";
import { useState } from "react";
import { FieldErrors, UseFormRegister } from "react-hook-form";
import { IoEyeOutline, IoEyeOffOutline } from "react-icons/io5";
import { z } from "zod";

type TFormData = z.infer<typeof ChangePasswordFormSchema>

type TEnterPasswordInput = {
    register: UseFormRegister<TFormData>;
    errors: FieldErrors<TFormData>;
    label: string;
    name: "currentPassword" | "newPassword" | "confirmPassword";
    placeholder: string;
}

const EnterPasswordInput = ({register, errors, label, name, placeholder}: TEnterPasswordInput) => {
    const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="w-full">
        <label className="text-sm text-[#344054] font-medium" htmlFor={name}>{label}</label>
        <div className="w-full h-fit relative mt-1.5">
            <input {...register(name)} placeholder={placeholder} className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pr-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type={showPassword ? "text" : "password"} id={name} />
            <button onClick={() => setShowPassword(prev => !prev)} type="button" className="absolute cursor-pointer text-[#98A2B3] right-3.5 top-1/2 -translate-y-1/2">
                {showPassword ? <IoEyeOffOutline /> : <IoEyeOutline />}
            </button>
        </div>
        {errors[name] && <p className="text-red-500 text-sm mt-1">{errors[name].message}</p>}
    </div>
  )
}

export default EnterPasswordInput