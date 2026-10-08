import useBackButtonStore from "@/stores/useBackButtonStore";
import { useEffect, useState } from "react";
import { TNotification } from "@/lib/api/dashboard-apis/notificationsApi";
import NotificationList from "@/components/dashboard/notifications/NotificationList";
import NotificationDetails from "@/components/dashboard/notifications/NotificationDetails";
import useIsMobile from "@/hooks/useIsMobile";

const NotificationsPage = () => {
    const [selectedNotif, setSelectedNotif] = useState<TNotification | null>(null);
    const {setButtonUrl} = useBackButtonStore();

    const isMobile = useIsMobile();

    useEffect(() => {
        setButtonUrl("/dashboard");

        return () => setButtonUrl(null)
    }, [setButtonUrl]);

  return (
    selectedNotif && isMobile ? <NotificationDetails selectedNotif={selectedNotif} setSelectedNotif={setSelectedNotif} /> : <NotificationList selectedNotif={selectedNotif} setSelectedNotif={setSelectedNotif} />
  )
}

export default NotificationsPage