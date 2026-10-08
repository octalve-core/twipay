
import type { TPaymentProvider } from "@/components/dashboard/add-funds/SelectPaymentMethod";
import type { FundingInitiation } from "@/lib/api/dashboard-apis/funding";
import { create } from "zustand";

type TAddFunds = {
    step: number;
    amount: string;

    paymentMethod: TPaymentProvider | null;

    generatedAccount: FundingInitiation | null;

    update: (fields: Partial<Omit<TAddFunds, "update">>) => void;
    reset: () => void;
}

const initialState = {
    step: 1,
    amount: "",
    paymentMethod: null,

    generatedAccount: null
}

const useAddFundsStore = create<TAddFunds>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default useAddFundsStore;