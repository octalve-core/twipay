import { useState } from "react";

import { PiCopy } from "react-icons/pi";
import { Check } from "lucide-react";

import CustomButton from "@/components/CustomButton"
import useAddFundsStore from "@/stores/useAddFundsStore";
import { copyToClipboard, formatAmount } from "@/lib/utils";
import BackButton from "@/components/Authentication/BackButton";
import { useNavigate } from "react-router-dom";
import { useCountdown } from "@/hooks/useCountdown";

const MakePayment = () => {
    const [copied, setCopied] = useState(false);
    const navigate = useNavigate()
    const {update, generatedAccount, paymentMethod, amount, reset } = useAddFundsStore();

    const copyAccount = async (text: string) => {
        await copyToClipboard(text);
        setCopied(true);

        setTimeout(() => {
            setCopied(false)
        }, 2000)
    }
    
    const timeLeft = useCountdown(generatedAccount?.paymentDetails.expiresAt as string, generatedAccount?.paymentDetails.expiresAt as string);

    const handlePayment = () => {
        navigate("/dashboard")
        reset();
    }
    
    if(!generatedAccount) return null
    

  return (
    <section className="w-full max-w-[360px] mx-auto">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon action={() => update({step: 2})}/>
            <div className="flex items-center justify-center gap-1.5 mr-6 w-full">
                <img src={paymentMethod?.logo} className="size-[26px] object-cover" />
                <p className="text-[#667085] font-medium text-xl">{generatedAccount.paymentDetails.bankName} Payment</p>
            </div>
        </div>

        <p className="text-sm text-[#1C1C1CCC] mt-14 mb-6 md:hidden">Fund your account by transferring {formatAmount(parseInt(amount))} to this virtual account</p>

        <div className="max-md:hidden">
            <BackButton className="mb-8" action={() => update({step: 2})} />
            <h1 className="text-[#112929] font-medium text-2xl">Add funds</h1>
            <p className="text-[#717171] mt-2">Send {formatAmount(parseInt(amount))} to the account below to fund</p>
        </div>

        {/* <div className="flex mt-8 w-full gap-2 justify-center">
            <span className="text-[#333333AB] text-lg">Account expires in</span>
            <span className="text-[#112929] text-lg">29:34</span>
        </div>

        <div className="w-full max-w-[360px] mx-auto">
            <div className="flex flex-col text-[#00128F] bg-[#00128F1A] rounded-lg p-3 w-full my-8">
                <p className="opacity-80">FIRST BANK</p>
                <p className="font-bold text-[32px]">0021117795</p>
                <p className="opacity-80">FABSPAY - ANNA KESHINRO</p>
            </div>

            <CustomButton className="w-full">Done</CustomButton>
        </div> */}

        <img src={paymentMethod?.logo} className="size-[46px] mt-9 mx-auto mb-[18px] object-cover" />

        <div className="flex flex-col w-full max-w-[360px] mx-auto">
            <div className="flex items-end gap-2">
                <div className="">
                    <h2 className="max-md:text-sm text-[#333333AB]">Account Number</h2>
                    <p className="text-[#00128F] text-xl md:text-2xl font-bold">{generatedAccount.paymentDetails.accountNumber}</p>
                </div>
                <button disabled={copied} onClick={() => copyAccount(generatedAccount.paymentDetails.accountNumber)} className="grid place-items-center cursor-pointer size-[26px] bg-[#745DB11A] text-[#00128F] rounded-[3px]">
                    {copied ? <Check className="text-green-500 size-4" /> : <PiCopy className="size-4" />}
                </button>
            </div>

            <div className="w-full bg-[#BBBBBB4D] mt-[15px] mb-[13px] h-[0.6px]" />

            <div className="">
                <h2 className="max-md:text-sm text-[#333333AB]">Bank Name</h2>
                <p className="text-[#31373D] md:text-2xl">{generatedAccount.paymentDetails.bankName}</p>
            </div>

            <div className="w-full bg-[#BBBBBB4D] mt-[15px] mb-[13px] h-[0.6px]" />

            <div className="">
                <h2 className="max-md:text-sm text-[#333333AB]">Account Name</h2>
                <p className="text-[#31373D] md:text-2xl">{generatedAccount?.paymentDetails.accountName}</p>
            </div>

            <CustomButton onClick={handlePayment} className="w-full mt-8">Done</CustomButton>
        </div>


        <div className="flex my-8 w-full gap-2 justify-center">
            <span className="text-[#333333AB] md:text-lg">Account expires in</span>
            <span className="text-[#112929] md:text-lg">{timeLeft}</span>
        </div>

        {/* <div className="max-md:hidden flex items-center justify-center gap-2 text-lg w-full">
            <span className="text-[#333333AB]">or</span>
            <button className="cursor-pointer text-[#112929]">Pay with Opay Wallet</button>
        </div> */}
    </section>
  )
}

export default MakePayment