import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

import { signUpFormSchema } from "@/lib/zodSchemas/auth.schema"
import CustomButton from "../CustomButton"
import { Link, useNavigate } from "react-router-dom"
import { IoEyeOffOutline, IoEyeOutline } from "react-icons/io5"
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"
import { SignUpUser } from "@/lib/api/authApi"
import { AxiosError } from "axios"

export type TFormData = z.infer<typeof signUpFormSchema>

const SignUpForm = () => {
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const {refreshSession} = useAuth()

    const {
            register,
            handleSubmit,
            reset,
            formState: {errors}
    } = useForm<TFormData>({
        resolver: zodResolver(signUpFormSchema)
    })

    const {mutate, isPending} = useMutation({
        mutationFn: SignUpUser,
        onSuccess: async () => {
            try {
                // Registration sets a server-side session; the UI must verify it before navigation.
                await refreshSession();
                reset();
                toast.success("User created successfully!");
                navigate("/dashboard");
            } catch {
                toast.error("Account created, but we could not confirm your session. Please sign in.");
                navigate("/auth/login");
            }
        },
        onError: (error: AxiosError) => {

            const errData = error.response?.data as { message?: string };
            if(errData.message){
                return toast.error(errData.message)
            }
            toast.error("Something went wrong, please try again")
        }
    })
    
    const onSubmit = async (data: TFormData) => {
        mutate(data);
    }

  return (
    <div className="mt-10 w-full">
        <h2 className="text-4xl text-[#101828] font-medium">Sign up</h2>
        <p className="mt-3 text-[#475467]">Please enter your details to sign up.</p>

        <div className="flex items-center gap-1 mt-3">
            <p className="text-sm ">Already have an account?</p>
            <Link to="/auth/login" className="font-medium text-[#112929] hover:opacity-80 transition cursor-pointer">Log in</Link>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8">
            <div className="w-full">
                <label className="text-[#344054] text-sm font-medium" htmlFor="firstname">First name</label>
                <input id="firstname" {...register("firstname")} placeholder="Enter your First name" className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-1.5 focus:border-[#112929] transition" />
                {errors.firstname && <p className="text-red-500 text-sm mt-1">{errors.firstname.message}</p>}
            </div>
            <div className="w-full mt-5">
                <label className="text-[#344054] text-sm font-medium" htmlFor="lastname">Last name</label>
                <input id="lastname" {...register("lastname")} placeholder="Enter your Last name" className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-1.5 focus:border-[#112929] transition" />
                {errors.lastname && <p className="text-red-500 text-sm mt-1">{errors.lastname.message}</p>}
            </div>
            <div className="w-full mt-5">
                <label className="text-[#344054] text-sm font-medium" htmlFor="email">Email address</label>
                <input id="email" {...register("email")} type="email" placeholder="Enter your email address" className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-1.5 focus:border-[#112929] transition" />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>
            <div className="w-full mt-5">
                <label className="text-sm text-[#344054] font-medium" htmlFor="password">Password</label>
                <div className="w-full h-fit relative mt-1.5">
                    <input {...register("password")} placeholder="••••••••" className="w-full border-[0.5px] border-[#D0D5DD] rounded-md py-2.5 px-3.5 pr-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type={showPassword ? "text" : "password"} id="password" />
                    <button onClick={() => setShowPassword(prev => !prev)} type="button" className="absolute cursor-pointer text-[#98A2B3] right-3.5 top-1/2 -translate-y-1/2">
                        {showPassword ? <IoEyeOffOutline /> : <IoEyeOutline />}
                    </button>
                </div>
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
            </div>
            <div className="w-full mt-5">
                <label className="text-[#344054] text-sm font-medium" htmlFor="referral">Referral code (not yet available)</label>
                <input id="referral" disabled title="Referrals will be introduced later" {...register("referralCode")} placeholder="Enter a referral code" className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-1.5 focus:border-[#112929] transition" />
                {errors.referralCode && <p className="text-red-500 text-sm mt-1">{errors.referralCode.message}</p>}
            </div>
            <CustomButton isLoading={isPending} disabled={isPending} className="w-full mt-6 px-2">Create account</CustomButton>
        </form>
    </div>
  )
}

export default SignUpForm