import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog";
import { useState } from "react";
import CustomButton from "@/components/CustomButton";
import { formatAmount } from "@/lib/utils";
import BackButton from "@/components/Authentication/BackButton";

  type TFundCardForm = {
    amount: string;
    setAmount: React.Dispatch<React.SetStateAction<string>>;
    setShowPinForm: React.Dispatch<React.SetStateAction<boolean>>;
  }

const FundCardForm = ({amount, setAmount, setShowPinForm}: TFundCardForm) => {
    const [openDialog, setOpenDialog] = useState(false);

    const handleProceed = () => {
        setOpenDialog(false);
        setShowPinForm(true);
    }

  return (
    <section className="w-full max-w-[360px] mx-auto max-md:self-start">
        <div className="flex items-center mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon href="/dashboard/virtual-card"/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Fund card</p>
        </div>

        <p className="md:hidden text-[#344054] text-2xl font-medium text-center mt-14">Fund your virtual card</p>

        <div className="hidden md:block">
            <BackButton href="/dashboard/virtual-card" className="mb-8" />  
            <h1 className="text-[#112929] font-bold text-[28px]">Fund virtual card</h1>
            <p className="text-[#667085]  text-sm mt-1">Add funds to your virtual card.</p>
        </div>

        <div className="flex flex-col mt-5 md:hidden">
            <p className="text-sm text-[#344054] font-medium mb-1.5">Fund with</p>
            <div className="h-8 rounded-sm w-full bg-[#1A1A31] grid place-items-center text-white text-xs">
                Wallet balance (₦ 1,650,000)
            </div>
        </div>
        
        <div className="w-full my-6 md:my-5">
            <label className="text-sm text-[#344054] font-medium" htmlFor="amount">Amount</label>
            <div className="w-full h-fit relative mt-1.5">
                <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount to fund" className="w-full border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 pl-10 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]" type="number" min={1} id="amount" />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2">₦</span>
            </div>
        </div>

        <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
            <AlertDialogTrigger asChild>
                <CustomButton disabled={!amount} className="w-full">Proceed - <span className="opacity-60">- Confirm transaction</span></CustomButton>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white border-0 rounded-lg w-[95vw] !max-w-[500px] h-full !max-h-[331px] md:!max-h-[437px] !p-0 flex flex-col items-center md:justify-center">
                <div className="w-full flex items-center h-[61px] md:hidden border-b border-[#E9E9E97D] px-4">
                    <BackButton icon action={() => setOpenDialog(false)} />
                    <p className="text-[#1C1C1C] text-lg w-full text-center mr-6">Fund card</p>
                </div>
                <div className="w-[90%] md:w-full max-w-[345px] mx-auto">
                    <AlertDialogHeader>
                        <BackButton action={() => setOpenDialog(false)} className="mb-8 max-md:hidden" />  
                        <AlertDialogTitle className="text-black md:text-[#112929] text-[22px] md:text-[28px] font-medium md:font-bold leading-7">
                            Fund virtual card
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-[#667085] text-sm mt-1 mb-3 max-md:hidden">
                            Add funds to your virtual card.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <p className=" text-[#717171] md:text-xl mb-8 md:mb-5 max-md:text-center max-md:mt-3">Are you sure you want to fund this virtual card with {formatAmount(parseInt(amount))} from your wallet balance?</p>
                    <div className="flex flex-col w-full gap-2">
                        <CustomButton onClick={handleProceed}>Yes, Proceed</CustomButton>
                        <CustomButton className="text-[#112929] font-medium" onClick={() => setOpenDialog(false)} variant="primary">No, cancel</CustomButton>
                    </div>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    </section>
  )
}

export default FundCardForm