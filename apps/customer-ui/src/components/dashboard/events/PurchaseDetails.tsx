import {useState,type FormEvent} from 'react';
import CustomButton from '@/components/CustomButton';
import useEventsStore from '@/stores/useEventsStore';
import BackButton from '@/components/Authentication/BackButton';
import { brand } from "@/config/brand";
const inputStyle='w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] placeholder:text-sm placeholder:text-[#667085]';
export default function PurchaseDetails(){
 const {update,recipientName,selectedEvent,selectedTicketTypeId}=useEventsStore();const [name,setName]=useState(recipientName);const [error,setError]=useState('');
 const onSubmit=(e:FormEvent)=>{e.preventDefault();if(!selectedEvent||!selectedTicketTypeId||name.trim().length<2||name.trim().length>180){setError('Please provide a full recipient name and select a ticket.');return;}update({recipientName:name.trim(),step:3});};
 return <section className="w-full max-w-[410px] mx-auto"><div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5"><BackButton icon action={()=>update({step:1})}/><p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Purchase details</p></div>
 <div className="max-md:hidden"><BackButton action={()=>update({step:1})} className="mb-6"/><h1 className="font-medium text-2xl text-[#112929] mb-2">Purchase details</h1><h2 className="text-[#717171]">Please enter the ticket holder's name</h2></div>
 <form onSubmit={onSubmit} className="mt-14 md:mt-7 flex flex-col gap-5 md:gap-7"><div><label className="text-sm text-[#344054] font-medium" htmlFor="ticket-holder">Full name</label><input id="ticket-holder" value={name} onChange={e=>{setName(e.target.value);setError('');}} autoComplete="name" maxLength={180} placeholder="Enter ticket holder's full name" className={inputStyle}/></div><p className="text-[#667085] text-sm">Your order and tickets will belong to your signed-in {brand.name} account. Email delivery uses your verified account address.</p>{error&&<p role="alert" className="text-red-600 text-sm">{error}</p>}<CustomButton className="w-full">Proceed - <span className="opacity-60">Review purchase</span></CustomButton></form></section>;
}
