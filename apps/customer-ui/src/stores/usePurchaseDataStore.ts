import { IDataPlan } from "@/components/dashboard/services/data/SelectProvider";
import { create } from "zustand";

export interface DataTransactionResult {
  result: {
    id: string;
    reference: string;
    amount: number;
    direction: "DEBIT" | "CREDIT";
    type: string;
    status: "success" | "failed" | "pending";
    purpose: string;
    provider: string;
    description: string;
    balanceBefore: number;
    balanceAfter: number;
    createdAt: string; // ISO date string
    updatedAt: string; // ISO date string
    metadata: {
      provider: string;
      phone: string;
      serviceName: string;
      serviceCode: string;
      productName: string;
      logo: string;
      remark: string;
      providerReference: string;
    };
  };
  providerStatus: string;
  pending: boolean;
}

type TPurchaseData = {
    step: number;
    providerName: string,
    providerId: string | null,
    type: "DIRECT" | "SME",
    phone: string,
    plan: string,

    txnResult: DataTransactionResult | null,

    dataPlans: IDataPlan[]
    
    update: (fields: Partial<Omit<TPurchaseData, "update">>) => void;
    reset: () => void;
}

const initialState = {
    step: 1,
    providerName: "",
    providerId: "",
    type: "DIRECT" as const,
    phone: "",
    plan: "",

    txnResult: null,

    dataPlans: [],
}

const usePurchaseDataStore = create<TPurchaseData>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default usePurchaseDataStore;