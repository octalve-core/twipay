import { TFormData } from "@/components/dashboard/hotels/CustomerInfoForm";
import { create } from "zustand";

type THotel = {
    customerInfo: TFormData | null;
    dob: Date | null;
    checkin: Date | null;
    checkout: Date | null;
    // selectedHotelId: number | null;

    isSuccessful: boolean;

    update: (fields: Partial<Omit<THotel, "update">>) => void;
    reset: () => void;
}

const initialState = {
    customerInfo: null,
    dob: null,
    checkin: null,
    checkout: null,
    // selectedHotelId: null

    isSuccessful: false
}

const useHotelsStore = create<THotel>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default useHotelsStore;