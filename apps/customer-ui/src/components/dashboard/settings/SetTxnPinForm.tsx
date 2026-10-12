import CustomButton from "@/components/CustomButton";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/context/AuthContext";
import { setTransactionPin } from "@/lib/api/authApi";
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
    const [password, setPassword] = useState("");

    const {refreshSession} = useAuth();
    
    const {mutate, isPending: isSettingPin} = useMutation({
        mutationFn: setTransactionPin,
        onSuccess: async () => {
            await refreshSession().catch(()=>{});
            setPin("");
            setPassword("")
            disableBackButton(false)
            toast.success("Transaction PIN is set. Financial services remain subject to eligibility checks.")
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
        mutate({pin, password})
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

            <label htmlFor="pin-set-password" className="block text-sm text-[#344054] mt-4 mb-1">Confirm your account password</label>
            <input id="pin-set-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required className="w-full rounded-md border border-[#D0D5DD] p-3" />
            <p className="mt-2 text-xs text-[#667085]">Avoid obvious PINs such as 1234 or repeating digits.</p>
            <CustomButton isLoading={isSettingPin} disabled={pin.length < 4 || !password || isSettingPin } className="w-full mt-6">Confirm</CustomButton>
        </form>
  )
}

export default SetTxnPinForm