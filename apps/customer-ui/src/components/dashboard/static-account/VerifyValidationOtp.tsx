import BackButton from "@/components/Authentication/BackButton";
import CustomButton from "@/components/CustomButton";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp"
import { useAuth } from "@/context/AuthContext";
import { getUser } from "@/lib/api/authApi";
import { validateIdentityOtp } from "@/lib/api/dashboard-apis/staticAccountApis";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const VerifyValidationOtp = ({setShowVerifyForm, identityId, setIdentityId}: {setShowVerifyForm: React.Dispatch<React.SetStateAction<boolean>>; setIdentityId: React.Dispatch<React.SetStateAction<string | null>>; identityId: string | null}) => {
  const [otp, setOtp] = useState<string>("");
  const {setAuthData, accessToken, refreshToken} = useAuth();

  const {mutate: verifyBvnOtp, isPending: isVerifying} = useMutation({
    mutationFn: validateIdentityOtp,
    onSuccess: async (response) => {
        (void 0)
        try {
            const updatedUser = await getUser();
            (void 0);
            setAuthData(updatedUser, accessToken as string, refreshToken as string);
        } catch (err) {
            (void 0);
        }
        setOtp("")
        toast.success("BVN verified successfully!")
        setShowVerifyForm(false);
        setIdentityId(null)
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
      verifyBvnOtp({identityId: identityId as string, otp})
  }
  

  return (
    <div className="container flex flex-col items-center">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
          <BackButton icon href="/dashboard"/>
          <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Verify OTP</p>
        </div>
        <div className="max-md:mt-14">
            <h2 className="text-2xl text-[#101828] font-medium">OTP Verification</h2>
            <p className="mt-3 text-[#475467]">Enter the OTP sent to the phone number linked to your bvn</p>
        </div>
        <form onSubmit={handleSubmit} className="w-full md:max-w-[410px] mt-8">
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
            <CustomButton isLoading={isVerifying} disabled={otp.length < 6 || isVerifying} className="w-full mt-6">Proceed - <span className="opacity-60">create account</span></CustomButton>
        </form>
    </div>
  )
}

export default VerifyValidationOtp