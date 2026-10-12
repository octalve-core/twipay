import { useState } from "react";

import PhoneInput, { CountryData } from "react-phone-input-2";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { LoaderCircle } from "lucide-react";

import { verifyPhoneNumberSchema } from "@/lib/zodSchemas/auth.schema";
import CustomButton from "@/components/CustomButton";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { sendPhoneCode, verifyPhoneNo } from "@/lib/api/authApi";
import { AxiosError } from "axios";
import { useAuth } from "@/context/AuthContext";

type TFormData = z.infer<typeof verifyPhoneNumberSchema>

type TUpdatePhoneModal = {
    closeModal: () => void;
    disableBackButton: (value: boolean) => void; //To disable back button
}

const VerifyNewPhoneNoForm = ({closeModal, disableBackButton}: TUpdatePhoneModal) => {
    const [isFocused, setIsFocused] = useState(false);

    const [countdown, setCountdown] = useState(0);

    const [dialCode, setDialCode] = useState("");
    const [localPhone, setLocalPhone] = useState("");

    const { user, accessToken, refreshToken, setAuthData} = useAuth()

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
            disableBackButton(false);
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
            disableBackButton(false);

            const errData = error.response?.data as { message?: string };
            if(errData.message){
                return toast.error(errData.message)
            }
            toast.error("Something went wrong, please try again")
        }
    })

    const {mutate: verifyPhone, isPending: isVerifying} = useMutation({
        mutationFn: verifyPhoneNo,
        onSuccess: (data) => {
            const user = data?.user;
            disableBackButton(false);
            toast.success("Phone number linked successfully!");
            setAuthData(user, accessToken as string, refreshToken as string);
            closeModal()
        },
        onError: (error: AxiosError) => {
            disableBackButton(false);

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
        
        disableBackButton(true);
        sendVerCode({phoneCode: dialCode, phone: localPhone})
    }

    const onSubmit = (data: TFormData) => {
        disableBackButton(true);
        verifyPhone({phone: localPhone, otp: data.code})
    }

  return (
        <form onSubmit={handleSubmit(onSubmit)} className="w-full">
            <div className="w-full">
                <label className="text-[#344054] text-sm font-medium mb-2" htmlFor="lastname">Phone number</label>
                <Controller
                    name="phone"
                    control={control}
                    render={({field}) => (
                        <div className="relative">
                            <PhoneInput
                                disabled={!!user?.phoneVerifiedAt}
                                country={'ng'}
                                value={field.value || (user && `${user.phoneCode} ${user.phone}`)}
                                onChange={(value, data: CountryData) => {
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
                            { !user?.phoneVerifiedAt &&
                                (sendingCode ? (
                                    <LoaderCircle className="animate-spin size-4 text-[12008F] absolute top-1/3 right-3.5" />
                                ) : (
                                    <button disabled={isVerifying || sendingCode} type="button" onClick={sendCode} className="cursor-pointer text-[#112929] text-sm absolute top-1/3 right-3.5 hover:opacity-80 transition">Send code</button>
                                ))
                            }
                        </div>
                    )}
                />
                {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
            </div>
            {!user?.phoneVerifiedAt && <div className="w-full mt-5">
                <label className="text-[#344054] text-sm font-medium" htmlFor="lastname">Input code</label>
                <input {...register("code")} placeholder="--- ---" className="w-full outline-0 bg-white py-2.5 px-3 border border-[#D0D5DD] shadow-[#1018280D] placeholder:text-[#667085] rounded-md mt-2 focus:border-[#112929] transition" />
                {errors.code && <p className="text-red-500 text-sm mt-1">{errors.code.message}</p>}
            </div>}
            <CustomButton isLoading={isVerifying} disabled={sendingCode || isVerifying || !!user?.phoneVerifiedAt} className="mt-6 w-full">Proceed</CustomButton>
        </form>
  )
}

export default VerifyNewPhoneNoForm