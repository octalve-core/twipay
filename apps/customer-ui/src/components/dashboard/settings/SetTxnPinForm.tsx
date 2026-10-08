import CustomButton from "@/components/CustomButton";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/context/AuthContext";
import { getUser, setTransactionPin } from "@/lib/api/authApi";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type TSetTxnPinForm = {
    closeModal: () => void;
    disableBackButton: (value: boolean) => void; //To disable back button
}


const SetTxnPinForm = ({closeModal, disableBackButton}: TSetTxnPinForm) => {
    const [pin, setPin] = useState("");

    const {setAuthData, refreshToken, accessToken} = useAuth();
    
    const {mutate, isPending: isSettingPin} = useMutation({
        mutationFn: setTransactionPin,
        onSuccess: async (data) => {
            try {
                const updatedUser = await getUser();
                setAuthData(updatedUser, accessToken as string, refreshToken as string);
            } catch (err) {
                (void 0);
            }
            setPin("")
            disableBackButton(false)
            toast.success(data.message)
            closeModal()
        },
        onError: (error: AxiosError) => {
            disableBackButton(false)
            const errData = error.response?.data as { message?: string };
            if(errData.message){
                return toast.error(errData.message)
            }
            toast.error("Something went wrong, please try again")
        }
    })

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        disableBackButton(true)
        mutate(pin)
    }

  return (
        <form onSubmit={handleSubmit} className="w-full">
            <div className="">
                <label className="text-sm font-medium text-[#344054] mb-1.5">Pin</label>
                <InputOTP 
                    pattern={REGEXP_ONLY_DIGITS} 
                    maxLength={4}
                    value={pin}
                    onChange={(value) => setPin(value)}
                >
                    <InputOTPGroup className="flex w-full max-w-[350px] gap-6">
                    {
                        Array.from({length: 4}).map((_, index) => (
                            <InputOTPSlot key={index} className="border !rounded-md w-full h-12 md:h-16 text-4xl md:text-5xl text-[#667085] font-medium" index={index} />
                        ))
                    }
                    </InputOTPGroup>
                </InputOTP>
            </div>

            <CustomButton isLoading={isSettingPin} disabled={pin.length < 4 || isSettingPin } className="w-full mt-6">Comfirm</CustomButton>
        </form>
  )
}

export default SetTxnPinForm