import { useState } from "react";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LuShield } from "react-icons/lu";
import Set2FAForm from "./Set2FAForm";
import BackButton from "@/components/Authentication/BackButton";
import { useAuth } from "@/context/AuthContext";

// Preserves ErhaPay's settings row and modal; the old email OTP/toggle API
// is intentionally not used. Activation is completed only by TwiPay TOTP.
const Set2FAModal = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const {user} = useAuth();
  return (
    <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
      <button type="button" onClick={() => setOpenDialog(true)} className="cursor-pointer flex items-center gap-[9px] py-3.5 pr-3.5 text-[#344054] border-b-[0.1px] border-[#667085]/30 transition">
        <LuShield className="size-4" />
        <span className="text-[13px]">{user?.twofactorEnabled ? "Manage 2FA" : "Enable 2FA"}</span>
        <span aria-hidden className="w-[25px] h-[15px] rounded-full border-2 ml-auto flex items-center relative">
          <span className={`h-[80%] aspect-square rounded-full bg-[#112929] absolute ${user?.twofactorEnabled ? "right-[1.5px]" : "left-[1.5px]"}`} />
        </span>
      </button>
      <AlertDialogContent className="bg-white border-0 rounded-lg w-[95vw] !max-w-[430px] max-h-[90vh] overflow-y-auto !p-0 md:!p-10">
        <div className="w-full flex items-center h-[61px] md:hidden border-b border-[#E9E9E97D] px-4">
          <BackButton icon action={() => setOpenDialog(false)} />
          <p className="text-[#1C1C1C] text-lg w-full text-center mr-6">2FA</p>
        </div>
        <div className="w-[90%] max-w-[350px] mx-auto max-md:pb-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex flex-col justify-center max-md:text-left">
              <BackButton action={() => setOpenDialog(false)} className="mb-8 max-md:hidden" />
              <span className="text-[#112929] font-medium md:font-bold text-[22px] md:text-[28px]">2FA</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#475467] max-md:text-left">Secure your account with an authenticator app</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-8">
            <Set2FAForm enabled={Boolean(user?.twofactorEnabled)} closeModal={() => setOpenDialog(false)} />
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};
export default Set2FAModal;
