import { getWallet } from "@/lib/api/dashboard-apis/walletApis";
import { formatAmount } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { ImEyeBlocked } from "react-icons/im";
import { ImEye } from "react-icons/im";

interface TransactionMeta {
  paid_on: string;
  event_type: string;
  customer_email: string;
  payment_method: string;
  wallet_balance: number;
  settlement_amount: number;
}

interface Transaction {
  id: string;
  reference: string;
  provider_reference: string;
  amount: number;
  type: "credit" | "debit";
  provider: string;
  remark: string;
  purpose: string;
  status: "successful" | "pending" | "failed";
  meta: TransactionMeta;
  created_at: string;
}

export interface Wallet {
  type: string;
  balance: number;
  transactions: Transaction[];
}


const BalanceCard = () => {
    const [hideBalance, setHideBalance] = useState(false);

    const {
        data: wallet,
        isLoading,
        error
    } = useQuery<Wallet, Error>({
        queryKey: ["wallet", "twipay-v1"],
        queryFn: getWallet,
    })

    const formatted = wallet && typeof wallet.balance === "number" ? formatAmount(wallet.balance) : "0.00";
    const [integerPart, decimalPart] = formatted.split('.');

  return (
    <div className="w-full bg-black h-[110px] md:h-[152px] px-3.5 md:px-8 rounded-lg md:rounded-xl flex items-center justify-between">
        <div className="">
            <p className="text-xs md:text-base text-[#98A2B3] font-medium md:mb-2 tracking-[-0.5px]">Available Balance</p>
            {
                hideBalance ? <span className="text-white font-bolds text-xl">* * * * * *</span> : isLoading ? <Loader2 className="text-[#98A2B3] animate-spin" /> : error ? <span className="text-white text-sm" role="status">Balance temporarily unavailable</span> : <h2 className="text-white font-bold text-2xl md:text-3xl tracking-[4%]"><span className="font-medium"></span>{integerPart}<span className="text-[#98A2B3] text-xs md:text-base">.{decimalPart}</span></h2>
            }
        </div>
        <button className="cursor-pointer text-[#667185] hover:text-white transition">
            {
                hideBalance ? <ImEyeBlocked className="size-6 md:size-8" onClick={() => setHideBalance(prev => !prev)} /> : <ImEye className="size-6 md:size-8" onClick={() => setHideBalance(prev => !prev)} />
            }
        </button>
    </div>
  )
}

export default BalanceCard