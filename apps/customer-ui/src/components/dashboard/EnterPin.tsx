import CustomButton from "@/components/CustomButton";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/context/AuthContext";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { FormEvent } from "react";

type TEnterPin = {
    handleSubmit: (e: FormEvent) => void;
    value: string;
    noOfDigits?: number;
    onValueChange: React.Dispatch<React.SetStateAction<string>>;
    disable?: boolean;
}


const EnterPin = ({handleSubmit, value, onValueChange, disable, noOfDigits=4}: TEnterPin) => {
    const {user} = useAuth();
    if(!user?.pinActivatedAt) {
        return <CustomButton variant="primary" href="/dashboard/settings/security" className="w-full mt-8 md:mt-12 text-center">Set Transaction pin</CustomButton>
    }

  return (
        <form onSubmit={handleSubmit} className="max-w-[328px] mt-8 w-full">
            <InputOTP 
                pattern={REGEXP_ONLY_DIGITS} 
                maxLength={4}
                value={value}
                onChange={(value) => onValueChange(value)}
            >
                <InputOTPGroup className="flex w-full max-w-[210px] md:max-w-[328px] mx-auto justify-center gap-1 md:gap-6">
                   {
                    Array.from({length: noOfDigits}).map((_, index) => (
                        <InputOTPSlot key={index} className="border !rounded-md size-12 md:size-16 text-4xl md:text-5xl text-[#667085] font-medium" index={index} />
                    ))
                   }
                </InputOTPGroup>
            </InputOTP>
            <CustomButton isLoading={disable} disabled={value.length < 4 || disable} className="w-full mt-8 md:mt-12">Confirm</CustomButton>
        </form>
  )
}

export default EnterPin