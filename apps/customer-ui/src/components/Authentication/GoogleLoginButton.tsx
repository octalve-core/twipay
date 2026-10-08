import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import CustomButton from "../CustomButton";

import GoogleIcon from "@/assets/auth/apple-icon.png";
import { useMutation } from "@tanstack/react-query";
import { SignInWithGoogle } from "@/lib/api/authApi";
import { useAuth, User } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AxiosError } from "axios";

const GoogleLoginButton = ({disabled}: {disabled?: boolean}) => {
    const {setAuthData} = useAuth();

    const navigate = useNavigate()

      const {mutate, isPending: isLoggingIn} = useMutation({
          mutationFn: SignInWithGoogle,
          onSuccess: (data) => {
              (void 0)
              // if(data.error === "TWO_FA_REQUIRED"){
              //     return navigate("/auth/two-factor-authentication", {
              //         state: {
              //             email: variables.payload.email,
              //         }
              //     })
              // }
              
              const user = data.data.user as User;
              const accessToken = data.data.accessToken;
              const refreshToken = data.data.refreshToken;
  
              setAuthData(user, accessToken, refreshToken)
              toast.success(data.message || "Logged in successfully")
              navigate("/dashboard")
          },
          onError: (error: AxiosError) => {
              (void 0)
              const errData = error.response?.data as { message?: string };
              if(errData.message){
                  return toast.error(errData.message)
              }
              toast.error("Something went wrong, please try again")
          }
      })


  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);

      const user = result.user;
      const idToken = await user.getIdToken(true);

      (void 0);
      (void 0);

      mutate({payload: {googleIdToken: idToken}});
    } catch (error) {
      (void 0);
    }
  };

  return (
    <CustomButton onClick={handleGoogleLogin} disabled={disabled || isLoggingIn} type="button" variant="primary" className="flex items-center justify-center gap-3 mt-11 w-full border border-[#D0D5DD]">
        <img src={GoogleIcon} alt="google" className="size-6" /> 
        <span>Log in with Google</span>
    </CustomButton>
  );
};

export default GoogleLoginButton;
