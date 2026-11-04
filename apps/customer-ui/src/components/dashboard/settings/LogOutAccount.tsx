import CustomButton from "@/components/CustomButton";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import { Logout } from "@/lib/api/authApi";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useState } from "react";
import { HiOutlineChevronRight } from "react-icons/hi";
import { toast } from "sonner";

import LogOutIcon from "@/assets/auth/log-out-icon.svg"

const LogOutAccount = () => {
    const [openDialog, setOpenDialog] = useState(false);

    const {clearAuthData} = useAuth()

    const {mutate, isPending: isLoggingOut} = useMutation({
        mutationFn: Logout,
        onSuccess: () => {
            toast.success("Logged out.")
            clearAuthData();
        },
        onError: (error: AxiosError) => {
            void 0;
            const errData = error.response?.data as { message?: string };
            if(errData.message){
                return toast.error(errData.message)
            }
            toast.error("Something went wrong, please try again")
        }
    })

  return (
        <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
            <AlertDialogTrigger asChild>
                <button className="flex items-center justify-between cursor-pointer w-full group bg-white md:bg-transparent rounded-lg md:rounded-none max-md:p-2">
                    <div className="flex items-center gap-4">
                        <span className="size-10 md:size-12 grid place-items-center rounded-md md:rounded-full bg-[#FF00000A] text-[#FF0000]">
                            <img alt="" src={LogOutIcon} className="size-6 object-cover" />
                        </span>
                        <div className="">
                            <h2 className="text-[#101928] font-medium md:font-bold text-left">Log out</h2>
                            <p className="hidden md:block text-xs text-[#667185]">
                                Log out of your account
                            </p>
                        </div>
                    </div>

                    <HiOutlineChevronRight className="hidden md:block size-5 text-[#112929]" />
                </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white border-0 rounded-[20px] w-[95vw] !max-w-[430px] h-full !max-h-[387px] md:!max-h-[456px] !p-0 flex flex-col items-center justify-center">
                <span className="size-10 md:size-16 grid place-items-center rounded-md md:rounded-full bg-[#FF00000A] text-[#FF0000]">
                    <img alt="" src={LogOutIcon} className="size-6 object-cover" />
                </span>
                <div className="w-[90%] md:w-full max-w-[337px] mx-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-center text-[#344054] text-2xl font-bold leading-7">Log out?</AlertDialogTitle>
                        <AlertDialogDescription className="text-center text-[#475467] text-sm mt-3 mb-10">
                            You are about to log out of your account. Any unsaved changes/pending transactions will be lost, and you'll need to re-enter your login details to access your account again. 
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col w-full gap-2">
                        <CustomButton disabled={isLoggingOut}  onClick={() => setOpenDialog(false)}>No, Cancel</CustomButton>
                        <CustomButton isLoading={isLoggingOut} disabled={isLoggingOut} className="text-[#FF0000] text-lg" variant="primary" onClick={() => mutate()}>Yes, Logout</CustomButton>
                    </div>
                </div>
            </AlertDialogContent>
        </AlertDialog>
  )
}

export default LogOutAccount