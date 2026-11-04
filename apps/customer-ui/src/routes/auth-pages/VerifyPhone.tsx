import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import PhoneInput, {CountryData } from "react-phone-input-2";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { LoaderCircle } from "lucide-react";

import { verifyPhoneNumberSchema } from "@/lib/zodSchemas/auth.schema";
import CustomButton from "@/components/CustomButton";

import AuthLogomark from "@/assets/auth/AuthLogomark.png"
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { sendPhoneCode, verifyPhoneNo } from "@/lib/api/authApi";
import { AxiosError } from "axios";
import { useAuth } from "@/context/AuthContext";
import Loader from "@/components/Loader";
import BackButton from "@/components/Authentication/BackButton";
import Logo from "@/components/navbar/Logo";
// import { useAuth } from "@/context/AuthContext";

type TFormData = z.infer<typeof verifyPhoneNumberSchema>

const VerifyPhone = () => {
    const [isFocused, setIsFocused] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [authChecked, setAuthChecked] = useState(false);

    const [dialCode, setDialCode] = useState("");
    const [localPhone, setLocalPhone] = useState("");

    const { accessToken, user} = useAuth();
    
    const navigate = useNavigate();

    const {
        register,
        control,
        watch,
        handleSubmit,
        formState: {errors}
    } = useForm<TFormData>({
        resolver: zodResolver(verifyPhoneNumberSchema)
    })

    const phoneInput = watch("phone")

    const {mutate: sendVerCode, isPending: sendingCode} = useMutation({
        mutationFn: sendPhoneCode,
        onSuccess: () => {
            toast.success("Code has been sent to your phone number")

            setCountdown(60); // Start countdown
            const interval = setInterval(() => {
                setCountdown((prev) => {
                if (prev === 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
                });
            }, 1000);
        },
        onError: (error: AxiosError) => {
            const errData = error.response?.data as { message?: string };
            if(errData.message){
                return toast.error(errData.message)
            }
            toast.error("Something went wrong, please try again")
        }
    })

    const {mutate: verifyPhone, isPending: isVerifying} = useMutation({
        mutationFn: verifyPhoneNo,
        onSuccess: () => {
            toast.success("Phone number verified successfully!")
            
            navigate("/auth/set-pin")
        },
        onError: (error: AxiosError) => {
            const errData = error.response?.data as { message?: string };
            if(errData.message){
                return toast.error(errData.message)
            }
            toast.error("Something went wrong, please try again")
        }
    })

    const sendCode = () => {
        if(countdown > 0) {
            return toast.info(`Try again in ${countdown}s`)
        }

        if (!phoneInput || phoneInput.length < 10 || !dialCode || !localPhone) {
            toast.info("Please input a valid phone number")
            return
        }

        void 0;

        sendVerCode({phoneCode: dialCode, phone: localPhone})
    }

    const onSubmit = (data: TFormData) => {
        verifyPhone({phone: localPhone, otp: data.code})
    }

    useEffect(() => {
        if (accessToken === null || user === null) {
            navigate("/auth/signup");
        } else if(user?.phone && user.phoneCode) {
            navigate("/auth/set-pin");
        } else {
            setAuthChecked(true)
        }
    }, [accessToken, navigate, user]);
    
    if(!authChecked) return <Loader />
    
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 md:px-0 py-10">
        <div className="w-full max-w-[410px]">
            <BackButton href="/" className="max-md:hidden" />
            <Logo imgClassName="w-[91.5px] h-10 md:hidden" />
        </div>
        <img alt="" src={AuthLogomark} className="object-cover size-8 mb-1.5 mt-8 max-md:hidden" />
        <div className="md:text-center mt-10">
            <h1 className="text-4xl text-[#101828] font-medium">Phone number verification <span className="text-[#112929]">(4/4)</span></h1>
            <p className="mt-3 text-[#475467]">Please enter a valid phone number to sign up</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-[410px] mt-8">
            <div className="w-full md:mt-6">
                <label className="text-[#344054] text-sm font-medium mb-2" htmlFor="lastname">Phone number</label>
                <Controller
                    name="phone"
                    control={control}
                    render={({field}) => (
                        <div className="relative">
                            <PhoneInput
                                country={'ng'}
                                value={field.value}
                                onChange={(value, data: CountryData ) => {
                                    field.onChange(value)
                                    setDialCode("+"+data.dialCode);
                                    setLocalPhone(value.replace(data.dialCode, ""))
                                }}
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
                                    border: isFocused ? "1px solid #112929" : "1px solid #D0D5DD",
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
                            {
                                sendingCode ? (
                                    <LoaderCircle className="animate-spin size-4 text-[12008F] absolute top-1/3 right-3.5" />
                                ) : (
                                    <button disabled={isVerifying} type="button" onClick={sendCode} className="cursor-pointer text-[#112929] text-sm absolute top-1/3 right-3.5 hover:opacity-80 transition">Send code</button>
                                )
                            }
                        </div>
                    )}
                />
                {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
            </div>
            <div className="w-full mt-5">
                <label className="text-[#344054] text-sm font-medium" htmlFor="lastname">Input code</label>
                <input {...register("code")} placeholder="--- ---" className="w-full outline-0 bg-white py-2.5 px-3 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-2 focus:border-[#112929] transition" />
                {errors.code && <p className="text-red-500 text-sm mt-1">{errors.code.message}</p>}
            </div>
            <CustomButton isLoading={isVerifying} disabled={isVerifying} className="mt-6 w-full">Proceed</CustomButton>
            <CustomButton disabled={isVerifying} type="button" variant="primary" onClick={() => navigate("/auth/set-pin")} className="mt-1 w-full font-medium">skip</CustomButton>
        </form>
    </div>
  )
}

export default VerifyPhone