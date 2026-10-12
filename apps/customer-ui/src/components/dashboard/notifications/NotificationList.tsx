import type { Dispatch, SetStateAction } from 'react';
import BackButton from '@/components/Authentication/BackButton';
import {getNotificationInbox,markAllNotificationsRead,markNotificationRead,type TNotification} from '@/lib/api/dashboard-apis/notificationsApi';
import {useInfiniteQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {HiInformationCircle} from 'react-icons/hi';
import {cn} from '@/lib/utils';
import {AnimatePresence,motion} from 'framer-motion';
import {Link} from 'react-router-dom';
const key=['twipay','notification-inbox'];
type Props={selectedNotif:TNotification|null;setSelectedNotif:Dispatch<SetStateAction<TNotification|null>>};
export default function NotificationList({selectedNotif,setSelectedNotif}:Props){
 const cache=useQueryClient();
 const query=useInfiniteQuery({queryKey:key,initialPageParam:undefined as string|undefined,
  queryFn:({pageParam})=>getNotificationInbox(pageParam),getNextPageParam:(page)=>page.nextCursor??undefined,retry:false});
 const items=query.data?.pages.flatMap(page=>page.items)??[];
 const unreadCount=query.data?.pages[0]?.unreadCount??0;
 const mark=useMutation({mutationFn:markNotificationRead,onSuccess:()=>cache.invalidateQueries({queryKey:key})});
 const markAll=useMutation({mutationFn:markAllNotificationsRead,onSuccess:()=>cache.invalidateQueries({queryKey:key})});
 function open(item:TNotification){setSelectedNotif(item);if(!item.readAt)mark.mutate(item.id);}
 return <div className="md:pt-5"><BackButton icon href="/dashboard" className="mb-6 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5"/>
 <div className="flex items-center justify-between gap-3 max-md:mt-10"><h1 className="text-[#344054] font-medium text-3xl">Notifications</h1><Link to="/dashboard/settings/notification-preferences" className="text-[#112929] underline text-sm">Preferences</Link></div>
 <p className="text-[#727884] text-sm mt-2">Account updates and support messages. Security notifications always stay on.</p>
 <div className="flex justify-between gap-3 mt-4"><span className="text-sm text-[#667085]">{unreadCount} unread</span><button type="button" disabled={markAll.isPending||!unreadCount} onClick={()=>markAll.mutate()} className="text-sm text-[#112929] underline disabled:opacity-50">Mark all as read</button></div>
 {mark.isError||markAll.isError?<p role="alert" className="text-red-600 text-sm">Unable to update the inbox. Please retry.</p>:null}
 <div className="flex gap-10 mt-7 relative"><section className="w-full md:w-[55%] flex flex-col gap-4">
 {query.isPending&&<p role="status">Loading your notifications…</p>}
 {query.isError&&<p role="alert" className="text-red-600">Unable to load notifications.</p>}
 {items.length===0&&<p className="text-[#727884]">No notifications yet.</p>}
 {items.map(item=><button type="button" key={item.id} onClick={()=>open(item)} aria-label={`${item.readAt?'Read':'Unread'}: ${item.title}`} className={cn('flex items-start gap-4 md:bg-white rounded-xl p-3 border cursor-pointer hover:border-[#112929] transition text-left',selectedNotif?.id===item.id?'border-[#112929]':'border-transparent')}>
 <HiInformationCircle className="size-5 text-[#112929] shrink-0 mt-1"/><div><p className="text-[#344054] font-medium text-lg">{!item.readAt&&<span aria-label="Unread notification" className="inline-block size-2 rounded-full bg-[#112929] mr-2"/>}{item.title}</p><p className="text-[#727884] text-sm mt-1">{item.category.toLowerCase()}</p><p className="text-[#727884] text-xs mt-1">{new Date(item.createdAt).toLocaleString('en-NG')}</p></div></button>)}
 {query.hasNextPage&&<button type="button" disabled={query.isFetchingNextPage} onClick={()=>void query.fetchNextPage()} className="rounded-lg border border-[#D0D5DD] py-3 text-[#112929] text-sm disabled:opacity-50">{query.isFetchingNextPage?'Loading…':'Load older notifications'}</button>}
 </section><AnimatePresence>{selectedNotif&&<motion.section initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}} className="max-md:hidden md:w-[45%] h-fit md:bg-white rounded-lg py-9 px-6 md:flex flex-col gap-5 border border-[#0000001A] sticky top-0"><h2 className="text-[#112929] font-medium text-xl">{selectedNotif.title}</h2><p className="text-[#727884]">{selectedNotif.message}</p><Link to={selectedNotif.targetPath} className="text-[#112929] font-medium underline">View details</Link><p className="text-[#727884] text-xs">{new Date(selectedNotif.createdAt).toLocaleString('en-NG')}</p></motion.section>}</AnimatePresence></div></div>;
}
