import { useState } from "react";
import { useNavigate } from "react-router-dom";

import BackButton from "@/components/Authentication/BackButton";

import AuthLogomark from "@/assets/auth/AuthLogomark.png"
import VerifyEmailForm from "@/components/Authentication/VerifyEmailForm";
import CreateNewPasswordForm from "@/components/Authentication/CreateNewPasswordForm";
import SuccessMessage from "@/components/SuccessMessage";
import Logo from "@/components/navbar/Logo";

export type TPasswordResetFormData = {
    email: string;
    code: string;
}

const ResetPassword = () => {
    const [showNewPassForm, setShowNewPassForm] = useState(false);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

      const [formData, setFormData] = useState<TPasswordResetFormData>({
        email: "",
        code: "",
    });

    const navigate = useNavigate();

    const showPasswordResetSuccessMessage = () => setShowSuccessMessage(true);
    const showNewPasswordForm = () => setShowNewPassForm(true);

    if(showSuccessMessage) return <SuccessMessage message="Password reset successfully!" />

  return (
    <div className="flex flex-col items-center justify-center h-full px-5 md:px-0 py-10">
        <div className="w-full max-w-[410px]">
            <BackButton className="max-md:hidden" action={() => navigate("/auth/login") } />
            <Logo imgClassName="w-[91.5px] h-10 md:hidden" />
        </div>
        {
            showNewPassForm ? (
                <>
                    <div className="w-full md:text-center mt-10 md:mt-16">
                        <h2 className="text-4xl text-[#101828] font-medium">Set new password</h2>
                        <p className="mt-3 text-[#475467]">Enter a new password for your account</p>
                    </div>
                    <CreateNewPasswordForm formData={formData} showPasswordResetSuccessMessage={showPasswordResetSuccessMessage} />  
                </>
            ) : (
                <>
                    <img src={AuthLogomark} className="object-cover size-8 mb-1.5 mt-16 max-md:hidden" />
                    <div className="w-full md:text-center max-md:mt-10">
                        <h2 className="text-4xl text-[#101828] font-medium">Reset password</h2>
                        <p className="mt-3 text-[#475467]">Enter a registered email address to reset your password</p>
                    </div>
                    <VerifyEmailForm setFormData={setFormData} showNewPasswordForm={showNewPasswordForm} />  
                </>
            )
        }
    </div>
  )
}

export default ResetPassword;