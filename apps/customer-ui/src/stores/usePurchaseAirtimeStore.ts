import { create } from "zustand";

type AirtimeTransactionResult = {
  result: {
    id: string;
    reference: string;
    amount: number;
    direction: string;
    type: string;
    status: string;
    purpose: string;
    provider: string;
    description: string;
    balanceBefore: number;
    balanceAfter: number;
    createdAt: string;
    updatedAt: string;
    metadata: {
      provider: string;
      phone: string;
      serviceName: string;
      serviceCode: string;
      network: string;
      logo: string;
      remark: string;
      providerReference: string;
    };
  };
  providerStatus: string;
  pending: boolean;
}

type TPurchaseAirtime = {
    step: number;
    provider: string,
    phone: string,
    amount: string,

    txnResult: AirtimeTransactionResult | null;
    
    update: (fields: Partial<Omit<TPurchaseAirtime, "update">>) => void;
    reset: () => void;
}

const initialState = {
    step: 1,

    provider: "mtn-airtime",
    phone: "",
    amount: "",

    txnResult: null
}

const usePurchaseAirtimeStore = create<TPurchaseAirtime>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default usePurchaseAirtimeStore;