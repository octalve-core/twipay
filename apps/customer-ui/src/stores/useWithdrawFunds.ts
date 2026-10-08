import { TWithdrawToBankResponse } from "@/components/dashboard/withdraw-funds/ConfirmFundsWithdrawal";
import { TBank } from "@/components/dashboard/withdraw-funds/RecipientDetailForm";
import { create } from "zustand";

type TWithdrawFunds = {
    step: number;
    selectedBank: TBank | null,
    bank_account: string,
    accountName: string,
    amount: string,
    note: string,
    save: boolean,

    txnResult: TWithdrawToBankResponse | null,
    
    update: (fields: Partial<Omit<TWithdrawFunds, "update">>) => void;
    reset: () => void;
}

const initialState = {
    step: 1,
    selectedBank: null,
    bank_account: "",
    accountName: "",
    amount: "10",
    note: "",
    save: false,

    txnResult: null
}

const useWithdrawFundsStore = create<TWithdrawFunds>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default useWithdrawFundsStore;