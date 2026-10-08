import { create } from "zustand";

type TMobileMoney = {
    step: number;
    provider: string,
    wallet_no: string,
    amount: string,

    isSuccessful?: boolean,
    
    update: (fields: Partial<Omit<TMobileMoney, "update">>) => void;
    reset: () => void;
}

const initialState = {
    step: 1,
    provider: "mtn",
    wallet_no: "",
    amount: "10",

    isSuccessful: false
}

const useMobileMoneyStore = create<TMobileMoney>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default useMobileMoneyStore;