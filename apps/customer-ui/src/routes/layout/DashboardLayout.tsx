import { Navigate, Outlet } from "react-router-dom";

import ScrollToTop from "@/components/ScrollToTop";
import Sidebar from "../../components/dashboard/sidebar/Sidebar";
import DashboardHeader from "../../components/dashboard/DashboardHeader";
import { useRef } from "react";
import { useAuth } from "@/context/AuthContext";

const DashboardLayout = () => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const {loading, user, mfaRequired} = useAuth();

    if(loading) return null; 
    if(!user) return <Navigate to="/auth/login" replace />
    if(mfaRequired) return <Navigate to="/auth/two-factor-authentication" replace />

    // const userDatailFilled = !!(user.username && user.gender && user.country && user.state);
    // if(!userDatailFilled) return <Navigate to="/auth/user-details" replace />

    return (
        <div className="h-screen fixed left-1/2 -translate-x-1/2 overflow-y-hidden flex items-start w-full max-w-[1440px] mx-auto">
            <div className="hidden md:block h-full">
                <Sidebar />
            </div>
            <main className="h-full w-full">  
                <DashboardHeader />
                <div ref={scrollRef} className="bg-[#F9FAFB] w-full h-full overflow-y-auto px-5 md:px-8 pt-5 pb-32">
                    <ScrollToTop containerRef={scrollRef}>
                        <Outlet />
                    </ScrollToTop>
                </div>
            </main>
        </div>
    )
}

export default DashboardLayout