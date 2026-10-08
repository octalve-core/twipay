import { create } from "zustand";

type TESim = {
    step: number;
    country: string,
    provider: string,
    validity: string,

    isSuccessful: boolean,
    
    update: (fields: Partial<Omit<TESim, "update">>) => void;
    reset: () => void;
}

const initialState = {
    step: 1,
    country: "",
    provider: "",
    validity: "",

    isSuccessful: false
}

const useESimStore = create<TESim>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default useESimStore;