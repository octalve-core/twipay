
import { TFormData } from "@/components/dashboard/virtual-card/VirtualCardWithdrawFundsForm";
import { create } from "zustand";

type TVirtualCardWithdraw = {
    showPinForm: boolean;
    withdrawalDetails: TFormData | null;

    update: (fields: Partial<Omit<TVirtualCardWithdraw, "update">>) => void;
    reset: () => void;
}

const initialState = {
    showPinForm: false,
    withdrawalDetails: null,
}

const useVirtualCardWithdraw = create<TVirtualCardWithdraw>((set) => ({
    ...initialState,

    update: (fields) => set((state) => ({ ...state, ...fields})),
    reset: () => set(initialState)
}))

export default useVirtualCardWithdraw;