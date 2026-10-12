import { TIntCountry } from "@/components/dashboard/services/international-airtime/RecipientDetails";
import { create } from "zustand";

type IntAirtimeTransactionResult = {
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
      countryCode: string;
      remark: string;
      providerReference: string;
    };
  };
  providerStatus: string;
  pending: boolean;
}

type TPurchaseIntAirtime = {
    step: number;
    provider: string,
    country: TIntCountry | null,
    phone: string,
    amount: string,

    txnResult: IntAirtimeTransactionResult | null;
    
    update: (fields: Partial<Omit<TPurchaseIntAirtime, "update">>) => void;
    reset: () => void;
}

const initialState = {
    step: 1,

    provider: "",
    country: null,
    phone: "",
    amount: "",

    txnResult: null
}

const usePurchaseIntAirtimeStore = create<TPurchaseIntAirtime>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default usePurchaseIntAirtimeStore;