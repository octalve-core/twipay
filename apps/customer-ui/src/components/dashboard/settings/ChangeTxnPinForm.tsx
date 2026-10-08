import CustomButton from "@/components/CustomButton";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { changeTransactionPin } from "@/lib/api/authApi";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type TChangeTxnPinForm = {
    closeModal: () => void;
    disableBackButton: (value: boolean) => void; //To disable back button
}


const ChangeTxnPinForm = ({closeModal, disableBackButton}: TChangeTxnPinForm) => {
    const [currPin, setCurrPin] = useState("");
    const [newPin, setNewPin] = useState("");
    
    const {mutate, isPending: isChangingPin} = useMutation({
        mutationFn: changeTransactionPin,
        onSuccess: () => {
            disableBackButton(false);
            setCurrPin("")
            setNewPin("")
            toast.success("Transaction pin changed successfully!")
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
        mutate({newPin: newPin, oldPin: currPin})
    }

  return (
        <form onSubmit={handleSubmit} className="w-full">
            <div className="">
                <label className="text-sm font-medium text-[#344054] mb-1.5">Current Pin</label>
                <InputOTP 
                    pattern={REGEXP_ONLY_DIGITS} 
                    maxLength={4}
                    value={currPin}
                    onChange={(value) => setCurrPin(value)}
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

            <div className="mt-6">
                <label className="text-sm font-medium text-[#344054] mb-1.5">New Pin</label>
                <InputOTP 
                    pattern={REGEXP_ONLY_DIGITS} 
                    maxLength={4}
                    value={newPin}
                    onChange={(value) => setNewPin(value)}
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
            <CustomButton isLoading={isChangingPin} disabled={currPin.length < 4 || newPin.length < 4 || isChangingPin } className="w-full mt-6">Confirm</CustomButton>
        </form>
  )
}

export default ChangeTxnPinForm