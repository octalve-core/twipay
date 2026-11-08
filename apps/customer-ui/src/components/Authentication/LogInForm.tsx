import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"
import CustomButton from "../CustomButton"
import { logInFormSchema } from "@/lib/zodSchemas/auth.schema"
import { z } from "zod"

// import AppleIcon from "@/assets/auth/google-icon.png";
import { IoEyeOffOutline, IoEyeOutline } from "react-icons/io5"
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { authErrorMessage } from "@/lib/authErrors"
import { useAuth } from "@/context/AuthContext"
import { GetMfaStatus, LogInUser, getCurrentSession } from "@/lib/api/authApi"
import { AxiosError } from "axios"
import GoogleLoginButton from "./GoogleLoginButton"

export type TFormData = z.infer<typeof logInFormSchema>;

const LogInForm = () => {
    const [showPassword, setShowPassword] = useState(false);
    
    const navigate = useNavigate()
    const {refreshSession} = useAuth()

    const {mutate, isPending: isLoggingIn} = useMutation({
        mutationFn: LogInUser,
        onSuccess: async () => {
            try {
                await refreshSession();
                const status = await GetMfaStatus();
                const session = await getCurrentSession();
                reset();
                if (status.mfa.enabled) {
                    navigate("/auth/two-factor-authentication");
                } else if (!session.user.contactVerified) {
                    navigate("/auth/verify-email", {replace:true});
                } else {
                    toast.success("Welcome back!");
                    navigate("/dashboard");
                }
            } catch {
                toast.error("We couldn’t finish signing you in. Please try again.");
            }
        },
        onError: (error: AxiosError) => {



            toast.error(authErrorMessage(error))
        }
    })

    const {
            register,
            handleSubmit,
            reset,
            formState: {errors}
        } = useForm<TFormData
        >({
            resolver: zodResolver(logInFormSchema)
        })
    
        const onSubmit = (data: TFormData) => {
            mutate({payload: data})
        }
    
  return (
    <div className="mt-10 w-full">
        <h1 className="text-4xl text-[#101828] font-medium">Welcome back</h1>
        <p className="mt-3 text-[#475467]">Jump right back in and pick up where you left off.</p>

        <div className="flex items-center gap-1 mt-3">
            <p className="text-sm ">Don&apos;t have an account?</p>
            <Link to="/auth/signup" className="font-medium text-[#112929] hover:opacity-80 transition cursor-pointer">Sign up</Link>
        </div>

        <form autoComplete="on" onSubmit={handleSubmit(onSubmit)} className="mt-8 w-full">
            <div className="w-full">
                <label className="text-[#344054] text-sm font-medium" htmlFor="email">Email</label>
                <input id="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} type="email" placeholder="Enter your email address" className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-1.5 focus:border-[#112929] transition" autoComplete="email" />
                {errors.email && <p id="email-error" role="alert" className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
            </div>
            <div className="w-full mt-5">
                <label className="text-sm text-[#344054] font-medium" htmlFor="password">Password</label>
                <div className="w-full h-fit relative mt-1.5">
                    <input {...register("password")} placeholder="••••••••" className="w-full border-[0.5px] border-[#D0D5DD] rounded-md py-2.5 px-3.5 pr-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type={showPassword ? "text" : "password"} id="password" aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} autoComplete="current-password" />
                    <button onClick={() => setShowPassword(prev => !prev)} type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-controls="password" className="absolute cursor-pointer text-[#98A2B3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#112929] rounded-sm right-3.5 top-1/2 -translate-y-1/2">
                        {showPassword ? <IoEyeOffOutline /> : <IoEyeOutline />}
                    </button>
                </div>
                {errors.password && <p id="password-error" role="alert" className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
            </div>

            <div className="my-6 mt-3 flex justify-end">
                <Link to="/auth/reset-password" className="text-[#112929] text-sm font-medium hover:underline">Forgot password?</Link>
            </div>

            <CustomButton isLoading={isLoggingIn} disabled={isLoggingIn} className="w-full">Log in</CustomButton>

        </form>
        <GoogleLoginButton disabled={isLoggingIn} />

    </div>
  )
}

export default LogInForm