import DashboardMockup from "@/assets/auth/Dashboard_Mockup.png"
import LogInForm from "@/components/Authentication/LogInForm"


import Logo from "@/components/navbar/Logo"
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

const Login = () => {
  const {user, loading, mfaRequired} = useAuth();

  if (loading) return <main role="status" className="min-h-screen grid place-items-center text-[#667085]">Checking your session…</main>;
  if (user) return <Navigate to={mfaRequired ? "/auth/two-factor-authentication" : "/dashboard"} replace />

  return (
    <div className="flex items-center h-screen">
        <div className="w-full h-full bg-[#F2F4F7] max-md:hidden relative">
          <img src={DashboardMockup} alt="" aria-hidden="true" className="w-[80%] h-[85vh] absolute top-1/2 -translate-y-1/2 right-0" />
        </div>
        <div className="h-full w-full overflow-y-auto">
            <div className="w-full max-w-[360px] mx-auto flex flex-col items-start py-10 max-md:px-6">
                <Logo imgClassName="w-[91.5px] h-10" />
                <LogInForm />
            </div>
        </div>
    </div>
  )
}

export default Login