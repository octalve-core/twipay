import type { Dispatch, SetStateAction } from 'react';
import {Link} from 'react-router-dom';
import BackButton from '@/components/Authentication/BackButton';
import type {TNotification} from '@/lib/api/dashboard-apis/notificationsApi';
type Props={selectedNotif:TNotification;setSelectedNotif:Dispatch<SetStateAction<TNotification|null>>};
export default function NotificationDetails({selectedNotif,setSelectedNotif}:Props){
 return <div className="pt-5"><div className="flex items-center mb-6 mt-2 fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5"><BackButton icon action={()=>setSelectedNotif(null)}/><p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Notification details</p></div>
 <div className="md:bg-white rounded-sm px-0 md:p-10 flex flex-col gap-4 mt-12"><h2 className="text-[#344054] font-medium text-3xl">{selectedNotif.title}</h2><p className="text-[#667085] text-sm">{new Date(selectedNotif.createdAt).toLocaleString('en-NG')}</p><p className="text-[#344054] text-sm">{selectedNotif.message}</p><Link to={selectedNotif.targetPath} className="text-[#112929] font-medium underline">View details</Link></div></div>;
}
