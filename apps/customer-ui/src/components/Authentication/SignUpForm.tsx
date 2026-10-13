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
import { authErrorMessage } from "@/lib/authErrors"
import { useAuth } from "@/context/AuthContext"
import { SignUpUser } from "@/lib/api/authApi"
import { AxiosError } from "axios"
import GoogleLoginButton from "./GoogleLoginButton"

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
        onSuccess: async (result) => {
            try {
                // Registration sets a server-side session; the UI must verify it before navigation.
                await refreshSession();
                reset();
                toast.success("Welcome to TwiPay. Verify your email to continue.");
                navigate("/auth/verify-email", {replace:true, state:{verificationDelivery:result.verificationDelivery}});
            } catch {
                toast.error("Your account was created. Please sign in to continue.");
                navigate("/auth/login");
            }
        },
        onError: (error: AxiosError) => {

            toast.error(authErrorMessage(error))
        }
    })
    
    const onSubmit = async (data: TFormData) => {
        mutate(data);
    }

  return (
    <div className="mt-10 w-full">
        <h2 className="text-4xl text-[#101828] font-medium">Get started with TwiPay</h2>
        <p className="mt-3 text-[#475467]">A few details and you’re on your way.</p>

        <div className="flex items-center gap-1 mt-3">
            <p className="text-sm ">Already have an account?</p>
            <Link to="/auth/login" className="font-medium text-[#112929] hover:opacity-80 transition cursor-pointer">Log in</Link>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8">
            <div className="w-full">
                <label className="text-[#344054] text-sm font-medium" htmlFor="firstname">First name</label>
                <input id="firstname" autoComplete="given-name" aria-invalid={!!errors.firstname} aria-describedby={errors.firstname ? "firstname-error" : undefined} {...register("firstname")} placeholder="Enter your First name" className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-1.5 focus:border-[#112929] transition" />
                {errors.firstname && <p id="firstname-error" role="alert" className="text-red-500 text-sm mt-1">{errors.firstname.message}</p>}
            </div>
            <div className="w-full mt-5">
                <label className="text-[#344054] text-sm font-medium" htmlFor="lastname">Last name</label>
                <input id="lastname" autoComplete="family-name" aria-invalid={!!errors.lastname} aria-describedby={errors.lastname ? "lastname-error" : undefined} {...register("lastname")} placeholder="Enter your Last name" className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-1.5 focus:border-[#112929] transition" />
                {errors.lastname && <p id="lastname-error" role="alert" className="text-red-500 text-sm mt-1">{errors.lastname.message}</p>}
            </div>
            <div className="w-full mt-5">
                <label className="text-[#344054] text-sm font-medium" htmlFor="email">Email address</label>
                <input id="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} type="email" placeholder="Enter your email address" className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-1.5 focus:border-[#112929] transition" />
                {errors.email && <p id="email-error" role="alert" className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>
            <div className="w-full mt-5">
                <label className="text-sm text-[#344054] font-medium" htmlFor="password">Password</label>
                <div className="w-full h-fit relative mt-1.5">
                    <input {...register("password")} placeholder="••••••••" className="w-full border-[0.5px] border-[#D0D5DD] rounded-md py-2.5 px-3.5 pr-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type={showPassword ? "text" : "password"} id="password" autoComplete="new-password" aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} />
                    <button onClick={() => setShowPassword(prev => !prev)} type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-controls="password" className="absolute cursor-pointer text-[#98A2B3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#112929] rounded-sm right-3.5 top-1/2 -translate-y-1/2">
                        {showPassword ? <IoEyeOffOutline /> : <IoEyeOutline />}
                    </button>
                </div>
                {errors.password && <p id="password-error" role="alert" className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
            </div>
            <CustomButton isLoading={isPending} disabled={isPending} className="w-full mt-6 px-2">Create account</CustomButton>
        </form>
        <GoogleLoginButton disabled={isPending} />
    </div>
  )
}

export default SignUpForm
