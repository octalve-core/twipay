import { Outlet } from "react-router-dom";

import ScrollToTop from "@/components/ScrollToTop";
import Sidebar from "../../components/dashboard/sidebar/Sidebar";
import DashboardHeader from "../../components/dashboard/DashboardHeader";
import { useRef } from "react";
import AuthenticatedCustomerRoute from "./AuthenticatedCustomerRoute";

const DashboardLayout = () => {
    const scrollRef = useRef<HTMLDivElement>(null);
    return (
      <AuthenticatedCustomerRoute>
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
      </AuthenticatedCustomerRoute>
    )
}

export default DashboardLayout