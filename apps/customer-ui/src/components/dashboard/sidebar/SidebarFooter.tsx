import { GoSignOut } from "react-icons/go";

import UserAvatar from "@/components/dashboard/UserAvatar";
import { useMutation } from "@tanstack/react-query";
import { Logout } from "@/lib/api/authApi";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AxiosError } from "axios";
import { Link } from "react-router-dom";

const SidebarFooter = () => {
    const {clearAuthData, user} = useAuth()

    const {mutate, isPending: isLoggingOut} = useMutation({
        mutationFn: Logout,
        onSuccess: () => {
            clearAuthData();

            toast.success("Logged out.")
        },
        onError: (error: AxiosError) => {

            const errData = error.response?.data as { message?: string };
            if(errData.message){
                return toast.error(errData.message)
            }
            toast.error("Something went wrong, please try again")
        }
    })
  return (
    <footer className="pt-8 pb-6">
        <div className="w-full h-full px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
                
                <div className="relative size-10">
                    <UserAvatar avatar={user?.avatar} firstname={user?.firstname} lastname={user?.lastname} />
                </div>

                <Link className="hover:opacity-70 transition" to="/dashboard/settings/account">
                    <div className="flex flex-col h-full justify-center">
                        <h2 className="font-medium text-sm capitalize">{user?.firstname} {user?.lastname}</h2>
                        {user?.username ? <small className="text-sm text-[#98A2B3] ">@{user.username}</small> : null}
                    </div>
                </Link>
            </div>

            {isLoggingOut ? <Loader2 className="animate-spin text-[#727884] size-4" /> : <button type="button" aria-label="Sign out" onClick={() => mutate()} className="cursor-pointer">
                <GoSignOut className="text-[#727884] hover:text-[#112929] transition" />
            </button>}
        </div>
    </footer>
  )
}

export default SidebarFooter;