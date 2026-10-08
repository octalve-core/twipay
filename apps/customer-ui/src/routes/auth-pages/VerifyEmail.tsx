import CustomButton from "@/components/CustomButton"
import { useLocation, useNavigate } from "react-router-dom"

import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp"

import AuthLogomark from "@/assets/auth/AuthLogomark.png"
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"
import { FormEvent, useRef, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { resendOtpFn, verifyEmail } from "@/lib/api/authApi"
import { AxiosError } from "axios"
import BackButton from "@/components/Authentication/BackButton"
import Logo from "@/components/navbar/Logo"

const DISABLE_OTP_RESEND_BUTTON_TIME = 60;

const VerifyEmail = () => {
    const [time, setTime] = useState<number>(0);
    const [otp, setOtp] = useState<string>("");

    // const [authChecked, setAuthChecked] = useState(false);
    const { setAuthData} = useAuth();

    const navigate = useNavigate();
    const location = useLocation();
    const {email} = location.state as {email: string} || {};
    (void 0)

    if(!email){
        navigate("/auth/signup");
    }

  const intervalRef = useRef<number | null>(null);

  const startTimer = () => {
    intervalRef.current = window.setInterval(() => {
        setTime((prevTime: number) => {
            if (prevTime <= 1) {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
            }
            return 0;
            }
            return prevTime - 1;
        });
        }, 1000);
  }

    // Calculate minutes and seconds from the total remaining time
  const minutes: number = Math.floor(time / 60);
  const seconds: number = time % 60;

  // Format minutes and seconds with leading zeros
  const formattedMinutes: string = minutes.toString().padStart(2, '0');
  const formattedSeconds: string = seconds.toString().padStart(2, '0');

  const {mutate: verifyEmailFn, isPending: isVerifying} = useMutation({
    mutationFn: verifyEmail,
    onSuccess: (response) => {
        (void 0)
        const user = response.data.user;
        const accessToken = response.data.accessToken;
        const refreshToken = response.data.refreshToken;
        setAuthData(user, accessToken, refreshToken);
        setOtp("")
        toast.success("Email verified successfully!")
        navigate("/auth/user-details")
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

  const {mutate: resendOtp, isPending: isSendingOtp} = useMutation({
    mutationFn: resendOtpFn,
    onSuccess: (data) => {
        (void 0)
        toast.success("New Otp has been sent, please check your mail!")

        setTime(DISABLE_OTP_RESEND_BUTTON_TIME);
        startTimer();
    },
    onError: (error: AxiosError) => {
        const errData = error.response?.data as { message?: string };
            if(errData.message){
                return toast.error(errData.message)
            }
        toast.error("Something went wrong, please try again")
    }
  })

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        verifyEmailFn({email: email!, otp})
    }

    // useEffect(() => {
    //     if (token === null || user === null) {
    //         navigate("/auth/signup");
    //     }else if (user?.email_verified) {
    //         navigate("/auth/user-details");
    //     } else {
    //         setAuthChecked(true)
    //     }
    // }, [token, navigate, user]);

    // if(!authChecked) return <Loader />

  return (
    <div className="container flex flex-col items-center md:justify-center px-5 md:px-0 py-10 min-h-screen">
        <div className="w-full max-w-[410px]">
            <BackButton href="/" className="max-md:hidden" />
            <Logo imgClassName="w-[91.5px] h-10 md:hidden" />
        </div>
        <img src={AuthLogomark} className="object-cover size-8 mb-1.5 mt-6 max-md:hidden" />
        <div className="md:text-center max-md:mt-10">
            <h2 className="text-4xl text-[#101828] font-medium">Email verification <span className="text-[#112929]">(2/4)</span></h2>
            <p className="mt-3 text-[#475467] max-md:max-w-[223px]">Please enter the OTP sent to {email} to verify your email</p>
        </div>
        <form onSubmit={handleSubmit} className="w-full max-w-[410px] mt-8">
            <InputOTP 
                pattern={REGEXP_ONLY_DIGITS_AND_CHARS} 
                maxLength={6}
                value={otp}
                onChange={(value) => setOtp(value)}
            >
                <InputOTPGroup className="flex gap-1.5 md:gap-3 justify-between md:justify-center w-full">
                   {
                    Array.from({length: 6}).map((_, index) => (
                        <InputOTPSlot key={index} className="border !rounded-md size-12 text-4xl text-[#667085] font-medium" index={index} />
                    ))
                   }
                </InputOTPGroup>
            </InputOTP>
            <div className="mt-10 mb-6 mx-auto w-fit">
                <button type="button" onClick={() => resendOtp(email!)} disabled={time > 1 || isSendingOtp || isVerifying} className="disabled:opacity-40 disabled:pointer-events-none text-[#4F044F] cursor-pointer hover:opacity-80 transition">Resend OTP</button>
                 {time > 1 && <span className="text-[#667085]"> in {formattedMinutes}:{formattedSeconds}</span>}
            </div>
            <CustomButton isLoading={isVerifying} disabled={otp.length < 6 || isVerifying || isSendingOtp} className="w-full">Proceed - <span className="opacity-60">User detail</span></CustomButton>
        </form>
    </div>
  )
}

export default VerifyEmail;