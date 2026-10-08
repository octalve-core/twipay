import api from "../axios";
import { TWithdrawToBankPayload } from "@/components/dashboard/withdraw-funds/ConfirmFundsWithdrawal";
import { TTransferFundsPayload } from "@/components/dashboard/transfer-funds/ConfirmFundsTransfer";

// Source of truth: FinanceController GET /v1/wallets.
// Amounts are strings of kobo; never round-trip through JS Number.
export type Wallet = {
    id: string;
    currency: "NGN";
    status: string;
    postedBalanceMinor: string;
    activeHoldsMinor: string;
    availableBalanceMinor: string;
};

export const getWallet = async (): Promise<Wallet> => {
    const response = await api.get<{wallet: Wallet}>("/wallets");
    const wallet = response.data.wallet;
    if (!wallet || wallet.currency !== "NGN" ||
        ![wallet.availableBalanceMinor, wallet.postedBalanceMinor, wallet.activeHoldsMinor]
            .every(value => typeof value === "string" && /^-?(?:0|[1-9]\d*)$/.test(value))) {
        throw new TypeError("Unexpected TwiPay wallet response");
    }
    return wallet;
};

export const fetchVirtualAccountProviders = async () => {
    const res = await api.get("/virtual-account-providers")
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