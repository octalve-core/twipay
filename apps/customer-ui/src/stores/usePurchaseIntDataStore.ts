import { TIntCountry } from "@/components/dashboard/services/international-airtime/RecipientDetails";
import { Variation } from "@/components/dashboard/services/international-data/RecipientDetails";
import { create } from "zustand";

type IntDataTransactionResult = {
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

type TPurchaseIntData = {
    step: number;
    provider: string,
    product: Variation | null,
    country: TIntCountry | null,
    phone: string,
    amount: string,

    txnResult: IntDataTransactionResult | null;
    
    update: (fields: Partial<Omit<TPurchaseIntData, "update">>) => void;
    reset: () => void;
}

const initialState = {
    step: 1,

    provider: "",
    product: null,
    country: null,
    phone: "",
    amount: "",

    txnResult: null
}

const usePurchaseIntDataStore = create<TPurchaseIntData>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default usePurchaseIntDataStore;