import { FormEvent, useEffect, useState } from "react";

import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp"


import AuthLogomark from "@/assets/auth/AuthLogomark.png";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import CustomButton from "@/components/CustomButton";
import SuccessMessage from "@/components/SuccessMessage";
import { useMutation } from "@tanstack/react-query";
import { setTransactionPin } from "@/lib/api/authApi";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import Loader from "@/components/Loader";
import BackButton from "@/components/Authentication/BackButton";
import Logo from "@/components/navbar/Logo";

const SetTransactionPin = () => {
    const [txnPin, SetTxnPin] = useState<string>("");
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

    const [authChecked, setAuthChecked] = useState(false);

    const navigate = useNavigate();

    const {accessToken, user, refreshToken, setAuthData} = useAuth();
    (void 0)

        const {mutate, isPending: isSettingPin} = useMutation({
            mutationFn: setTransactionPin,
            onSuccess: (data) => {
                const {user} = data.data;
                setAuthData(user, accessToken as string, refreshToken as string)
                (void 0)
                SetTxnPin("")
                toast.success(data.message)
                setShowSuccessMessage(true)
            },
            onError: (error: AxiosError) => {
                (void 0)
                const errData = error.response?.data as { message?: string };
                if(errData.message){
                    return toast.error(errData.message)
                }
                toast.error("Something went wrong, please try again")
            }
        })

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        (void 0)
        mutate(txnPin)
    }

        useEffect(() => {
            if (accessToken === null || user === null) {
                navigate("/auth/signup");
            } else {
            setAuthChecked(true)
        }
        }, [accessToken, navigate, user]);

    if(!authChecked) return <Loader />

    if(showSuccessMessage) return <SuccessMessage message="Account created successfully!" />

  return (
    <div className="flex flex-col items-center md:justify-center px-5 md:px-0 py-10 min-h-screen">
        <div className="w-full max-w-[410px]">
            <BackButton className="max-md:hidden" action={() => navigate("/auth/verify-phone") } />
            <Logo imgClassName="w-[91.5px] h-10 md:hidden" />
        </div>
        <img src={AuthLogomark} className="object-cover size-8 mb-1.5 mt-6 max-md:hidden" />
        <div className="w-full md:text-center mt-10">
            <h2 className="text-4xl text-[#101828] font-medium">Set transaction pin</h2>
            <p className="mt-3 text-[#475467] max-md:max-w-[226px]">Enter a four digit pin to authorize all transactions</p>
        </div>
        <form onSubmit={handleSubmit} className="max-w-[410px] mt-8 w-full">
            <InputOTP 
                pattern={REGEXP_ONLY_DIGITS_AND_CHARS} 
                maxLength={4}
                value={txnPin}
                onChange={(value) => SetTxnPin(value)}
            >
                <InputOTPGroup className="flex w-full justify-center gap-3">
                   {
                    Array.from({length: 4}).map((_, index) => (
                        <InputOTPSlot key={index} className="border !rounded-md size-12 md:size-16 text-4xl text-[#667085] font-medium" index={index} />
                    ))
                   }
                </InputOTPGroup>
            </InputOTP>
            <CustomButton isLoading={isSettingPin} disabled={txnPin.length < 4 || isSettingPin} className="w-full mt-10">Complete sign up</CustomButton>
            <CustomButton disabled={isSettingPin} type="button" variant="primary" onClick={() => setShowSuccessMessage(true)} className="mt-1 w-full font-medium">skip</CustomButton>
        </form>
    </div>
  )
}

export default SetTransactionPin