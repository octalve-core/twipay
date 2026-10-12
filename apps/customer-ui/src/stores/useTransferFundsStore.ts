import { create } from "zustand";

export type TTransferFundsResponse = {
  reference: string;
  transferId: string;
  amount: string; // amount is a string in your JSON
  senderBalance: number;
  recipient: Recipient;
}

export interface Recipient {
  id: string;
  username: string;
  email: string;
}

type TTransferFunds = {
    step: number;
    
    user: string;
    amount: string;
    note: string;

    txnResult: TTransferFundsResponse | null;

    update: (fields: Partial<Omit<TTransferFunds, "update">>) => void;
    reset: () => void;
}

const initialState = {
    step: 1,
    user: "",
    amount: "",
    note: "",

    txnResult: null
}

const useTransferFundsStore = create<TTransferFunds>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default useTransferFundsStore;