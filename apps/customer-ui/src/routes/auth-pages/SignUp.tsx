import SignUpForm from "@/components/Authentication/SignUpForm"
import Logo from "@/components/navbar/Logo"

import DashboardMockup from "@/assets/auth/Dashboard_Mockup.png"
import { useAuth } from "@/context/AuthContext"
import { Navigate } from "react-router-dom"

const SignUp = () => {
  const {user} = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex items-center h-screen">
        <div className="w-full h-full bg-[#F2F4F7] max-md:hidden relative">
          <img src={DashboardMockup} className="w-[80%] h-[85vh] absolute top-1/2 -translate-y-1/2 right-0" />
        </div>
        <div className="h-full w-full overflow-y-auto">
            <div className="w-full max-w-[360px] mx-auto flex flex-col items-start py-10 max-md:px-6">
                <Logo imgClassName="w-[91.5px] h-10" />
                <SignUpForm />
            </div>
        </div>
    </div>
  )
}

export default SignUp;