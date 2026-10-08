import type { Dispatch, SetStateAction } from 'react';
import BackButton from '@/components/Authentication/BackButton';
import {getAllNotifications,type TNotification} from '@/lib/api/dashboard-apis/notificationsApi';
import {useQuery} from '@tanstack/react-query';
import {HiInformationCircle} from 'react-icons/hi';
import {cn} from '@/lib/utils';
import {AnimatePresence,motion} from 'framer-motion';
type Props={selectedNotif:TNotification|null;setSelectedNotif:Dispatch<SetStateAction<TNotification|null>>};
export default function NotificationList({selectedNotif,setSelectedNotif}:Props){
 const query=useQuery({queryKey:['twipay','notification-delivery-history'],queryFn:getAllNotifications,retry:false});
 return <div className="md:pt-5"><BackButton icon href="/dashboard" className="mb-6 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5"/>
 <h1 className="text-[#344054] font-medium text-3xl max-md:mt-10">Notifications</h1><p className="text-[#727884] text-sm mt-2">Delivery history for messages sent by TwiPay. Read/unread inbox state is not available yet.</p>
 <div className="flex gap-10 mt-7 md:mt-10 relative"><section className="w-full md:w-[55%] flex flex-col gap-5">
 {query.isPending&&<p role="status">Loading notification history…</p>}
 {query.isError&&<p role="alert" className="text-red-600">Unable to load notification history.</p>}
 {query.data?.length===0&&<p className="text-[#727884]">No notification delivery records yet.</p>}
 {query.data?.map(item=><button type="button" key={item.id} onClick={()=>setSelectedNotif(item)} className={cn('flex items-start gap-4 md:gap-1.5 md:bg-white rounded-xl p-3 border cursor-pointer hover:border-[#112929] transition text-left',selectedNotif?.id===item.id?'border-[#112929]':'border-transparent')}>
 <HiInformationCircle className="size-5 text-[#112929] shrink-0 mt-1"/><div><p className="text-[#344054] font-medium text-lg">{item.title}</p><p className="text-[#727884] text-sm mt-2">{item.channel} · {item.deliveryStatus}</p><p className="text-[#727884] text-xs mt-1">{new Date(item.createdAt).toLocaleString('en-NG')}</p></div></button>)}
 </section><AnimatePresence>{selectedNotif&&<motion.section initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}} className="max-md:hidden md:w-[45%] h-fit md:bg-white rounded-lg py-9 px-6 md:flex flex-col gap-5 border border-[#0000001A] sticky top-0"><h2 className="text-[#112929] font-medium text-xl">{selectedNotif.title}</h2><p className="text-[#727884]">Delivery channel: {selectedNotif.channel}</p><p className="text-[#727884]">Provider status: {selectedNotif.deliveryStatus}</p><p className="text-[#727884] text-xs">Full message content is not exposed by the delivery-status API.</p></motion.section>}</AnimatePresence></div></div>;
}
