import { TFundWalletPayload } from "@/components/dashboard/add-funds/SelectPaymentMethod";
import api from "../axios";
import { TWithdrawToBankPayload } from "@/components/dashboard/withdraw-funds/ConfirmFundsWithdrawal";
import { TTransferFundsPayload } from "@/components/dashboard/transfer-funds/ConfirmFundsTransfer";

export const getWallet = async () => {
    const res = await api.get(
        "/wallet"
    )
    return res.data.data;
}

export const fetchProviders = async () => {
    const res = await api.get("/wallet/providers")
    return res.data.data;
}

export const fetchVirtualAccountProviders = async () => {
    const res = await api.get("/virtual-account-providers")
    return res.data.data;
}

export const fundWallet = async (payload: TFundWalletPayload) => {
    const res = await api.post("/wallet/fund", {...payload, method: "bank_transfer", provider: "saveHaven"})
    return res.data.data;
}

export const fetchBankList = async () => {
    const res = await api.get("/reference/banks")
    return res.data.data;
}

export const withdrawToBank = async (payload: TWithdrawToBankPayload) => {
    const res = await api.post("/wallet/bank-transfer", payload)
    return res.data.data;
}

export const transferFunds = async (payload: TTransferFundsPayload) => {
    const res = await api.post("/wallet/transfer", payload)
    return res.data.data;
}

// export const getTxnHistory = async (): Promise<Transaction[]> => {
//     const res = await api.get("/wallet/transactions?page=1&per_page=10")
//     return res.data.data;
// }