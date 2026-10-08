import { useState } from "react";

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog";

import { CiEdit } from "react-icons/ci"
import { LuLockKeyhole } from "react-icons/lu"

import ChangePasswordForm from "./ChangePasswordForm";
import BackButton from "@/components/Authentication/BackButton";

const ChangePasswordModal = () => {
    const [openDialog, setOpenDialog] = useState(false);
    const [disableBackBtn, setDisableBackBtn] = useState(false);

    const disableBackButton = (value: boolean) => setDisableBackBtn(value)

    const closeModal = () => setOpenDialog(false);

  return (
        <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
            <AlertDialogTrigger asChild>
                <button onClick={() => setOpenDialog(prev => !prev)} className="cursor-pointer flex items-center gap-[9px] py-3.5 pr-3.5 text-[#344054] border-b-[0.1px] border-[#667085]/30 transition">
                    <LuLockKeyhole className="size-4" />
                    <span className="text-[13px]">Change password</span>
                    <div className="size-8 rounded-full bg-transparent grid place-items-center ml-auto">
                        <CiEdit className="size-4 text-[#112929]" />
                    </div>
                </button>
            </AlertDialogTrigger>

            <AlertDialogContent className="bg-white border-0 rounded-lg w-[95vw] !max-w-[430px] h-auto !md:min-h-[570px] !p-0 md:!p-10">
                <div className="w-full flex items-center h-[61px] md:hidden border-b border-[#E9E9E97D] px-4">
                    <BackButton disabled={disableBackBtn} icon action={() => setOpenDialog(false)} />
                    <p className="text-[#1C1C1C] text-lg w-full text-center mr-6">Change password</p>
                </div>
                <div className="w-[90%] max-w-[350px] mx-auto max-md:pb-5">
                    <AlertDialogHeader className="gap-0 max-md:text-left">
                        <AlertDialogTitle className="flex flex-col justify-center">
                            <BackButton disabled={disableBackBtn} action={() => setOpenDialog(false)} className="mb-8 max-md:hidden" />
                            <span className="text-[#112929] font-medium md:font-bold text-[22px] md:text-[28px]">Change password</span>
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-[#475467]">
                            secure your account.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="mt-8">
                        <ChangePasswordForm disableBackButton={disableBackButton} closeModal={closeModal} />
                    </div>
                </div>
            </AlertDialogContent>
        </AlertDialog>
  )
}

export default ChangePasswordModal