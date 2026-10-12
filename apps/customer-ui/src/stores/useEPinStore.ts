import { EpinProductType, EpinProviderType } from "@/components/dashboard/services/epin/SelectProvider";
import { create } from "zustand";

export type TransactionMeta = {
  productName: string;
  serviceCode: string;
  serviceName: string;
  profileId: string;
  phone: string;
}

export type TEpinTxnResponse = {
  result: {
    id: string;
    reference: string;
    amount: number;
    direction: "DEBIT" | "CREDIT";
    type: string;
    status: string;
    purpose: string;
    provider: string;
    providerReference: string;
    remark: string;
    createdAt: string; // or Date
    updatedAt: string; // or Date
  };
  status: string;
  providerStatus: string;
  pin: string;
  pending: boolean;
}

type TEpin = {
    step: number;
    selectedProvider: EpinProviderType | null,
    selectedProduct: EpinProductType | null,
    examNumber: string,

    txnResult: null | TEpinTxnResponse,
    
    update: (fields: Partial<Omit<TEpin, "update">>) => void;
    reset: () => void;
}

const initialState = {
    step: 1,
    selectedProvider: null,
    selectedProduct: null,
    examNumber: "",

    txnResult: null
}

const useEpinStore = create<TEpin>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default useEpinStore;