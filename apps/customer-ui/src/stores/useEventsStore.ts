import { create } from 'zustand';
import type { EventQuote, EventOrder } from '@/lib/api/dashboard-apis/eventContracts';
type TEvents={step:number;selectedEvent:string|null;selectedTicketTypeId:string|null;quantity:number;recipientName:string;quote:EventQuote|null;order:EventOrder|null;update:(fields:Partial<Omit<TEvents,'update'|'reset'>>)=>void;reset:()=>void};
const initial={step:1,selectedEvent:null,selectedTicketTypeId:null,quantity:1,recipientName:'',quote:null,order:null};
const useEventsStore=create<TEvents>((set)=>({...initial,update:(fields)=>set((state)=>({...state,...fields})),reset:()=>set(initial)}));
export default useEventsStore;
