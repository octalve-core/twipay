import { FlightData, TCity } from "@/lib/api/dashboard-apis/flightApis";
import { create } from "zustand";

type DocumentInfo = {
    type: string;
    number: string;
    nationality: string;
    birth_place: string;
    issuance_date: string;
    expiry_date: string;
    issuance_country: string;
    issuance_state: string;
    validity_country: string;
    is_holder: boolean;
};

export type PassengerFormData = {
    id: string;
    type: "adult" | "child" | "held_infant";
    dob: string;
    firstname: string;
    lastname: string;
    gender: string;
    email: string;
    phone_code: string;
    phone: string;
    documents?: DocumentInfo;
};

type TFlight = {
    ticketType: "one_way" | "round_trip";
    fromLocation: TCity | null;
    toLocation: TCity | null;
    flightType: string;
    departureDate: Date | null;
    arrivalDate: Date | null;
    adult_count: string;
    children_count: string;
    infant_count: string;

    airlines: FlightData[];

    selectedAirline: FlightData | null;

    // Passengers Info Form(s)
    passengerForms: PassengerFormData[];
    currentStep: number;

    setPassengerForms: (passengers: PassengerFormData[]) => void;
    updatePassenger: (index: number, data: Partial<PassengerFormData>) => void;
    setCurrentStep: (step: number) => void;
    goToNextPassenger: () => void;
    goToPrevPassenger: () => void;
    resetBooking: () => void;

    //
    bookedFlightId: string | null;

    update: (fields: Partial<Omit<TFlight, "update">>) => void;
    reset: () => void;
}

const initialState = {
    ticketType: "one_way" as const,
    fromLocation: null,
    toLocation: null,
    departureDate: null,
    arrivalDate: null,
    flightType: "",
    adult_count: "1",
    children_count: "",
    infant_count: "",

    airlines: [],

    selectedAirline: null,

    // Passengers Info Form(s)
    currentStep: 0,
    passengerForms: [],

    // 
    bookedFlightId: null
}

const useFlightStore = create<TFlight>((set) => ({
    ...initialState,
    
    setPassengerForms: (passengers) => set({ passengerForms: passengers }),
    updatePassenger: (index, data) =>
        set((state) => {
        const updated = [...state.passengerForms];
        updated[index] = { ...updated[index], ...data };
        return { passengerForms: updated };
    }),
    setCurrentStep: (step) => set({ currentStep: step }),
    goToNextPassenger: () =>
        set((state) => ({
        currentStep: Math.min(state.currentStep + 1, state.passengerForms.length - 1),
    })),
    goToPrevPassenger: () =>
        set((state) => ({
        currentStep: Math.max(state.currentStep - 1, 0),
    })),
    resetBooking: () => set({ passengerForms: [], currentStep: 0 }),

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default useFlightStore;