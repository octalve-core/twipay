import { create } from "zustand";

export type ElectricityMeta = {
  meterNumber: string;
  meterType: "prepaid" | "postpaid" | string;
  serviceCode: string;
  serviceName: string;
}

export type TElectricityTransaction = {
    result: {
      id: string;
      reference: string;
      amount: number;
      direction: "DEBIT" | "CREDIT";
      type: "electricity";
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
        meterNumber: string;
        meterType: "prepaid" | "postpaid";
        serviceName: string;
        serviceCode: string;
        logo: string;
        token: string;
        remark: string;
        providerReference: string;
      };
  };
  status: string;
  providerStatus: string;
  pin: string;
  pending: boolean;
}



type TElectricityBills = {
    step: number;
    provider: string,
    meterNumber: string,
    meterType: string,
    quantity: string,

    txnResult: TElectricityTransaction | null,
    
    update: (fields: Partial<Omit<TElectricityBills, "update">>) => void;
    reset: () => void;
}

const initialState = {
    step: 1,
    provider: "",
    meterNumber: "",
    meterType: "prepaid",
    quantity: "",

    txnResult: null
}

const useElectricityBillsStore = create<TElectricityBills>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default useElectricityBillsStore;