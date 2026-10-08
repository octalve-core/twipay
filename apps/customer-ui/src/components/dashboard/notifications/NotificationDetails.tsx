import BackButton from "@/components/Authentication/BackButton";
import { TNotification } from "@/lib/api/dashboard-apis/notificationsApi";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

type TNotificationDetails = {
    selectedNotif: TNotification;
    setSelectedNotif: React.Dispatch<React.SetStateAction<TNotification | null>>;
}

const NotificationDetails = ({selectedNotif, setSelectedNotif}: TNotificationDetails) => {
    const {user} = useAuth();

    const formatTime = (date: string) =>{ 
        return new Date(date).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        }).replace(" ", "");
    }

  return (
    <div className="pt-5">
        <div className="flex items-center mb-6 mt-2 fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon action={() => setSelectedNotif(null)}/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Notification details</p>
        </div>
        {
            selectedNotif && 
                <div className="md:bg-white rounded-sm px-0 md:p-10 flex flex-col md:gap-12 mt-8">
                    <div className="flex flex-col md:flex-row md:items-center md:gap-2 justify-between">
                        <h2 className="text-[#344054] md:text-[#112929] font-medium md:text-3xl">{selectedNotif.title}</h2>
                        <p className="text-[#667085] text-sm">{formatTime(selectedNotif.createdAt)} / {formatDate(selectedNotif.createdAt)}</p>
                    </div>

                    <h3 className="text-[#344054] font-medium md:text-2xl max-md:mt-12 max-md:mb-3.5">Hey {user?.username},</h3>
                    <p className="text-[#344054] md:text-[#727884] text-sm md:text-lg">{selectedNotif.message}</p>

                    {/* <div className="flex items-center justify-between max-md:mt-10">
                        <CustomButton className="flex items-center justify-center gap-3 h-11 md:h-[60px] w-full md:w-[350px] font-bold">
                            <FiDownload className="size-6" />
                            <span className="md:text-lg">Download Receipt</span>
                        </CustomButton>
                        <button className="text-[#FF0000] text-2xl cursor-pointer hover:opacity-80 transition max-md:hidden">Delete</button>
                    </div> */}
                </div>
        }
    </div>
  )
}

export default NotificationDetails