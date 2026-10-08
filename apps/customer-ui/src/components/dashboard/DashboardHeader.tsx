import { Link, useLocation } from "react-router-dom";

import { ChevronLeft } from "lucide-react";
import { GoBellFill } from "react-icons/go";

import VerifiedIcon from "@/assets/dashboard/verified_tick.png";
import useBackButtonStore from "@/stores/useBackButtonStore";
import { cn } from "@/lib/utils";
import Logo from "../navbar/Logo";
import MobileNavigation from "./MobileNavigation";
import { useAuth } from "@/context/AuthContext";

const DashboardHeader = () => {
    const {buttonUrl, onClick} = useBackButtonStore();
    const location = useLocation();
    const {user} = useAuth();

    const isDashboardPage = location.pathname === "/dashboard"

  return (
    <header className={cn("w-full bg-[#F9FAFB] md:bg-white md:border-b border-[#E4E7EC] z-10 h-[70px]", !isDashboardPage && "max-md:hidden")}>
        <div className="w-full h-full py-10 md:py-4 px-5 md:px-11 flex items-center justify-between">
            <Logo className="md:hidden" />
            {buttonUrl !== null && <Link to={buttonUrl} className="flex items-center gap-2 text-[#667185] cursor-pointer hover:opacity-65 transition font-medium">
                <ChevronLeft className="size-5" />
                <span className="">Back</span>
            </Link>}
            {onClick !== null && <button onClick={onClick} className="flex items-center gap-2 text-[#667185] cursor-pointer hover:opacity-65 transition font-medium">
                <ChevronLeft className="size-5" />
                <span className="">Back</span>
            </button>}
            
            <div className="flex items-center h-full ml-auto">
                <div className="w-[1px] h-full bg-[#E4E7EC]" />
                <Link to={"/dashboard/notifications"} className=" relative cursor-pointer ml-8 mr-7">
                    <GoBellFill className="text-[#667185] hover:text-[#112929] hover:scale-110 transition size-8" />
                </Link>
                <Link to="/dashboard/settings/account" className="hover:opacity-65 transition">
                    <div className="relative size-8">
                        <img src={user?.avatar || ""} className="size-full rounded-full object-cover bg-blue-100" />
                        <img src={VerifiedIcon} className="size-3 object-cover absolute right-0 bottom-0" />
                    </div>
                </Link>
                <div className="md:hidden ml-7 grid place-items-center">
                    <MobileNavigation />
                </div>
            </div>
        </div>
    </header>
  )
}

export default DashboardHeader