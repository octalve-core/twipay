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
import { useAuth } from "@/context/AuthContext"
import { GetMfaStatus, LogInUser } from "@/lib/api/authApi"
import { AxiosError } from "axios"
// import GoogleLoginButton from "./GoogleLoginButton"

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
                reset();
                if (status.mfa.enabled) {
                    navigate("/auth/two-factor-authentication");
                } else {
                    toast.success("Logged in successfully");
                    navigate("/dashboard");
                }
            } catch {
                toast.error("Unable to establish a verified session");
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
        <h2 className="text-4xl text-[#101828] font-medium">Log in</h2>
        <p className="mt-3 text-[#475467]">Welcome back! Please enter your details.</p>

        <div className="flex items-center gap-1 mt-3">
            <p className="text-sm ">Don&apos;t have an account?</p>
            <Link to="/auth/signup" className="font-medium text-[#112929] hover:opacity-80 transition cursor-pointer">Sign up</Link>
        </div>

        <form autoComplete="on" onSubmit={handleSubmit(onSubmit)} className="mt-8 w-full">
            <div className="w-full">
                <label className="text-[#344054] text-sm font-medium" htmlFor="email">Email</label>
                <input id="email" {...register("email")} type="email" placeholder="Enter your email address" className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-1.5 focus:border-[#112929] transition" autoComplete="email" />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>
            <div className="w-full mt-5">
                <label className="text-sm text-[#344054] font-medium" htmlFor="password">Password</label>
                <div className="w-full h-fit relative mt-1.5">
                    <input {...register("password")} placeholder="••••••••" className="w-full border-[0.5px] border-[#D0D5DD] rounded-md py-2.5 px-3.5 pr-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type={showPassword ? "text" : "password"} id="password" autoComplete="current-password" />
                    <button onClick={() => setShowPassword(prev => !prev)} type="button" className="absolute cursor-pointer text-[#98A2B3] right-3.5 top-1/2 -translate-y-1/2">
                        {showPassword ? <IoEyeOffOutline /> : <IoEyeOutline />}
                    </button>
                </div>
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
            </div>

            <div className="my-6 mt-3 flex items-center justify-between">
                <div className="flex items-center">
                    <input type="checkbox" id="terms" className="w-4 h-4 accent-[#112929] cursor-pointer" />
                    <label htmlFor="terms" className="text-[#344054] text-sm font-medium ml-2">Remember for 30 days</label>
                </div>
                <Link to="/auth/reset-password" className="font-medium text-[#112929] text-sm hover:opacity-80 transition">Forgot password?</Link>
            </div>

            <CustomButton isLoading={isLoggingIn} disabled={isLoggingIn} className="w-full">Log in</CustomButton>

            {/* SOCIAL LOG IN BUTTONS */}
            {/* <GoogleLoginButton disabled={isLoggingIn} />
            <CustomButton onClick={()=>{}} disabled={isLoggingIn} type="button" className="flex items-center justify-center gap-3 bg-black mt-4 text-white w-full">
                <img src={AppleIcon} alt="google" className="size-6" /> 
                <span>Log in with Apple</span>
            </CustomButton> */}
        </form>
    </div>
  )
}

export default LogInForm