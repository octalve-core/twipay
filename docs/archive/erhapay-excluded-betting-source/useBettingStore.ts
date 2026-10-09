import { create } from "zustand";

export type TBettingTransaction = {
  result: {
    id: string;
    reference: string;
    amount: number;
    direction: "DEBIT" | "CREDIT";
    type: "betting";
    status: "pending" | "success" | "failed";
    purpose: string;
    provider: string;
    description: string;
    balanceBefore: number;
    balanceAfter: number;
    createdAt: string; // ISO date string
    updatedAt: string; // ISO date string
    metadata: {
      provider: string;
      customerId: string;
      serviceName: string;
      serviceCode: string;
      remark: string;
      providerReference: string;
    };
  };
  providerStatus: string;
  pending: boolean;
}


type TBetting = {
    step: number;
    provider: string,
    user: string,
    amount: string,

    txnResult: TBettingTransaction | null,
    
    update: (fields: Partial<Omit<TBetting, "update">>) => void;
    reset: () => void;
}

const initialState = {
    step: 1,
    provider: "",
    user: "",
    amount: "",

    txnResult: null
}

const useBettingStore = create<TBetting>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default useBettingStore;