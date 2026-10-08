import { TvProductType, TvProviderType } from "@/components/dashboard/services/tv-cable/RecipientDetails";
import { create } from "zustand";

export type CableTvMeta = {
  smartCardNumber: string;
  productName: string;
  serviceCode: string;
  serviceName: string;
  subscriptionType: string; // e.g. "renew" | "new"
}

export type TvSubscriptionResponse  = {
  result: {
    id: string;
    reference: string;
    amount: number;
    direction: "DEBIT" | "CREDIT";
    type: "e_pin";
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
      serviceName: string;
      serviceCode: string;
      productName: string;
      logo: string;
      profileId: string;
      phone: string;
      remark: string;
      providerReference: string;
    };
  };
  status: "success" | "failed" | "pending";
  providerStatus: string;
  pin: string;
  pending: boolean;
}


type TTVCable = {
    step: number;

    provider: TvProviderType | null,
    package: TvProductType | null,
    smartCardNo: string,

    txnResult: TvSubscriptionResponse | null,
    
    update: (fields: Partial<Omit<TTVCable, "update">>) => void;
    reset: () => void;
}

const initialState = {
    step: 1,
    provider: null,
    smartCardNo: "",
    package: null,

    txnResult: null
}

const useTVCableStore = create<TTVCable>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default useTVCableStore;