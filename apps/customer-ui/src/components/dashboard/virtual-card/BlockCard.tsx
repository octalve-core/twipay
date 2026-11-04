import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog";

import Octagon from "@/assets/dashboard/x-octagon.svg";
import { useState } from "react";
import CustomButton from "@/components/CustomButton";
import BackButton from "@/components/Authentication/BackButton";

const BlockCard = () => {
    const [openDialog, setOpenDialog] = useState(false);

    const handleProceed = () => {
        // make api call to block card
        setOpenDialog(false);
    }

  return (
        <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
            <AlertDialogTrigger asChild>
                <button className="flex flex-col items-center cursor-pointer">
                    <div className="bg-white size-[64px] grid place-items-center rounded-md md:rounded-lg border border-transparent hover:border-[#464E60] transition">
                        <img alt="" className="size-5 object-cover" src={Octagon} />
                    </div>
                    <span className="text-[#464E60] text-center text-xs">Block<br /> Card</span>
                </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white border-0 rounded-lg w-[95vw] !max-w-[647px] h-full !max-h-[317px] md:!max-h-[385px] !p-0 flex flex-col items-center md:justify-center">
                <div className="w-full flex items-center h-[61px] md:hidden border-b border-[#E9E9E97D] px-4">
                    <BackButton icon action={() => setOpenDialog(false)} />
                    <p className="text-[#1C1C1C] text-lg w-full text-center mr-6">Block card</p>
                </div>
                <div className="w-[90%] md:w-full max-w-[410px] mx-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center text-black text-[22px] md:text-[28px] font-medium leading-7">Block your card?</AlertDialogTitle>
                        <AlertDialogDescription className="text-center text-[#717171] md:text-xl mt-3 mb-8">
                            Are you sure you want to block this virtual card? you will no longer be able to use it
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col w-full gap-2">
                        <CustomButton onClick={handleProceed}>Yes, block it</CustomButton>
                        <CustomButton className="text-[#112929] font-medium" onClick={() => setOpenDialog(false)} variant="primary">No, cancel</CustomButton>
                    </div>
                </div>
            </AlertDialogContent>
        </AlertDialog>
  )
}

export default BlockCard