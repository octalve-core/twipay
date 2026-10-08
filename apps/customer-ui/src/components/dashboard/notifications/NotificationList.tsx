import BackButton from "@/components/Authentication/BackButton";
import { useAuth } from "@/context/AuthContext";
import { getAllNotifications, markAsRead, TNotification } from "@/lib/api/dashboard-apis/notificationsApi";
import { cn, formatDate } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HiInformationCircle } from "react-icons/hi";
import {AnimatePresence, motion} from "framer-motion"

type TNotificationList = {
    selectedNotif: TNotification | null;
    setSelectedNotif: React.Dispatch<React.SetStateAction<TNotification | null>>;
}

const NotificationList = ({ selectedNotif, setSelectedNotif}: TNotificationList) => {
    const queryClient = useQueryClient();
    const {user} = useAuth();

    const {
        data: notifications,
        isLoading: fetchingNotifications,
    } = useQuery<TNotification[], Error>({
        queryKey: ["notifications"],
        queryFn: getAllNotifications,
    })

    const unreadNotifCount = (notifications && notifications.length) && notifications?.filter((notif) => !notif.read).length || 0;

    const {mutate: markNotifAsRead, isPending: isMarkingAsRead} = useMutation({
      mutationFn: markAsRead,
      onSuccess: () => {
        queryClient.invalidateQueries({queryKey: ["notifications"]});
      },
    })

    const onClickMarkAsRead = (e: React.MouseEvent<HTMLSpanElement, MouseEvent>, notification: TNotification) => {
        e.stopPropagation()
        markNotifAsRead(notification._id);
    }

    const handleSelectNotification = (notification: TNotification) => {
        setSelectedNotif(null); 
        setTimeout(() => setSelectedNotif(notification) , 500)
        
        if (!notification.read) {
            markNotifAsRead(notification._id);
        }
    }

    const formatTime = (date: string) =>{ 
        return new Date(date).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        }).replace(" ", "");
    }

  return (
    <div className="md:pt-5">
        <BackButton icon href="/dashboard" className="mb-6 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5" />
        <h1 className="text-[#344054] font-medium text-3xl max-md:mt-10">Notifications {unreadNotifCount > 0 && <span>({unreadNotifCount})</span>}</h1>
        <div className="flex gap-10 mt-7 md:mt-10 relative">
            <section className="w-full md:w-[55%] flex flex-col gap-5">
                {
                    fetchingNotifications && Array.from({length: 5}).map((_, index) => (
                        <div key={index} className="w-full h-16 bg-gray-200 rounded-lg animate-pulse"/>
                    ))
                }
                {
                    !fetchingNotifications && notifications && notifications.length === 0 && <div className="text-[#727884]">No notifications found.</div>
                }
                {
                    (notifications && notifications.length) && notifications.map((notification) => {
                        const isSelected = selectedNotif === notification;
                        return (
                                <button 
                                    key={notification._id} 
                                    className={cn("flex items-start gap-4 md:gap-1.5 md:bg-white rounded-xl p-2 md:p-3 border cursor-pointer hover:border-[#112929] transition", isSelected ? "border-[#112929]" : "border-transparent")} 
                                    onClick={() => handleSelectNotification(notification)}
                                >
                                    <HiInformationCircle className={cn("size-4 shrink-0 mt-1.5", notification.read ? "text-[#344054]" : "text-[#112929]" )} />

                                    <div className="flex flex-col justify-start">
                                        <p className="text-[#344054] font-medium text-lg text-left line-clamp-1">{notification.title}</p>
                                        <p className="md:hidden line-clamp-1 text-[#727884] text-sm text-left my-2">{notification.message}</p>
                                        <div className="flex items-center gap-4">
                                            {(!notification.read && !isMarkingAsRead) && <span onClick={(e) => onClickMarkAsRead(e, notification)} 
                                            className="text-[#112929] text-lg cursor-pointer hover:opacity-80 transition">
                                                Mark as read</span>}
                                            {/* <span className="text-[#FF0000] text-lg cursor-pointer hover:opacity-80 transition">Delete</span> */}
                                        </div>
                                    </div>
                                </button>
                        )
                    })
                }
            </section>
            <AnimatePresence>
                {selectedNotif && <motion.section 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
                    exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }}
                    className="max-md:hidden md:w-[45%] h-fit md:bg-white rounded-lg py-9 px-6 md:flex flex-col md:gap-8 border border-[#0000001A] sticky top-0">
                    <div className="flex flex-col gap-8">
                        <h2 className="text-[#112929] font-medium text-xl">{selectedNotif.title}</h2>
                        <p className="text-xl text-[#727884] uppercase">{formatTime(selectedNotif.createdAt)} / {formatDate(selectedNotif.createdAt)}</p>
                    </div>

                    <h3 className="text-[#344054] font-medium md:text-xl">Hey {user?.username},</h3>
                    <p className="text-[#727884]">{selectedNotif.message}</p>

                    {/* <div className="flex flex-col items-center">
                        <CustomButton className="flex items-center justify-center gap-3 h-11 md:h-12 w-full md:w-[350px] font-bold">
                            <FiDownload className="size-6" />
                            <span className="">Download Receipt</span>
                        </CustomButton>
                        <button className="text-[#FF0000] cursor-pointer hover:opacity-80 transition max-md:hidden mt-5">Delete</button>
                    </div> */}
                </motion.section>}
            </AnimatePresence>
        </div>
    </div>
  )
}

export default NotificationList