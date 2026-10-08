import { TEventFormData } from "@/components/dashboard/events/PurchaseDetails";
import { create } from "zustand";

type TEvents = {
    step: number;
    // events: Tevent[],
    isSuccessful: boolean;
    data: TEventFormData | null,
    selectedEvent: number | null
    
    update: (fields: Partial<Omit<TEvents, "update">>) => void;
    reset: () => void;
}

const initialState = {
    step: 1,

    isSuccessful: false,
    data: null,
    selectedEvent: null
}

const useEventsStore = create<TEvents>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default useEventsStore;