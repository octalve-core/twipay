import { useState } from "react";
import { useNavigate } from "react-router-dom";

import BackButton from "@/components/Authentication/BackButton";

import AuthLogomark from "@/assets/auth/AuthLogomark.png"
import VerifyEmailForm from "@/components/Authentication/VerifyEmailForm";
import CreateNewPasswordForm from "@/components/Authentication/CreateNewPasswordForm";
import { Link } from "react-router-dom";
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

    if(showSuccessMessage) return <div className="min-h-screen flex flex-col items-center justify-center px-5 text-center">
      <h1 className="text-3xl font-medium text-[#101828]">Password updated</h1>
      <p className="mt-3 text-[#475467]">Your previous sessions are now signed out. Please log in with your new password.</p>
      <Link className="mt-5 font-medium text-[#112929] underline" to="/auth/login">Go to log in</Link>
    </div>

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
                    <img alt="" src={AuthLogomark} className="object-cover size-8 mb-1.5 mt-16 max-md:hidden" />
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