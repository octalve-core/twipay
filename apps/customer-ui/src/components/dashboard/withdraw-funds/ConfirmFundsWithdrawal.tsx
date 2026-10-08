import { FormEvent, useState } from "react"

import { formatAmount } from "@/lib/utils";
import CustomButton from "@/components/CustomButton"
import BackButton from "@/components/Authentication/BackButton"
import EnterPin from "@/components/dashboard/EnterPin";
import useIsMobile from "@/hooks/useIsMobile";
import useWithdrawFundsStore from "@/stores/useWithdrawFunds";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { withdrawToBank } from "@/lib/api/dashboard-apis/walletApis";
import { toast } from "sonner";

export type TWithdrawToBankPayload = {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amount: string;
  pin: string;
}

interface TransactionMeta {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
}

export interface TWithdrawToBankResponse {
  walletId: string;
  sourceId: string;
  reference: string;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  type: string; // e.g. "bank_transfer"
  provider: string;
  purpose: string;
  status: string; // e.g. "processing"
  idempotencyKey: string;
  initiatedBy: string;
  initiatedByType: "user" | "system";
  approvalStatus: string; // e.g. "pending"
  balanceBefore: number;
  balanceAfter: number;
  meta: TransactionMeta;
  _id: string;
  createdAt: string; // or Date
  updatedAt: string; // or Date
  __v: number;
}


const ConfirmFundsWithdrawal = () => {
  const [paymenTPin, SetPaymenTPin] = useState<string>("");
  const [showPinForm, setShowPinForm] = useState(false);

  const isMobile = useIsMobile();
  const { update, amount, bank_account, selectedBank, accountName } = useWithdrawFundsStore();

  const {mutate, isPending} = useMutation<TWithdrawToBankResponse, AxiosError, TWithdrawToBankPayload>({
    mutationFn: withdrawToBank,
    onSuccess: (data) => {
      update({step: 4, txnResult: data});
    },
    onError: (error: AxiosError) => {
      (void 0)
        update({step: 4, txnResult: null});
        const errData = error.response?.data as { message?: string };
        if(errData.message){
            return toast.error(errData.message)
        }
        toast.error("Something went wrong, please try again")
    }
  })

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if(!selectedBank) return

        mutate({bankCode: selectedBank.bankCode, accountNumber: bank_account, accountName: accountName, amount, pin: paymenTPin})
    }

  return (
    <div className="min-h-full flex md:items-center justify-center">
      {
        showPinForm ? 
          <section className="flex flex-col max-md:justify-center max-md:text-center">
                <BackButton disabled={isPending} icon={isMobile} action={() => setShowPinForm(false)} className="mb-8" />

                <h1 className="text-[#112929] font-medium text-2xl">Confirm Payment</h1>
                <p className="text-[#717171] mt-2 text-sm md:text-base">Enter your transaction pin to confirm this purchase</p>

                <EnterPin disable={isPending} handleSubmit={handleSubmit} value={paymenTPin} onValueChange={SetPaymenTPin} />
          </section> :
          <section className="w-full max-w-[358px] mx-auto flex flex-col max-md:justify-center max-md:text-center">
            <BackButton disabled={isPending} icon={isMobile} action={() => update({step: 2})} className="mb-8" />
            <h1 className="text-[#112929] font-medium text-2xl">Confirm Withdrawal</h1>
            <p className="text-[#717171] md:mt-2">Confirm the details of this withdrawal</p>

            <p className="text-[#101828] md:text-xl my-5 md:my-8">You are about to withdraw <span className="font-medium">{formatAmount(parseInt(amount))}</span> to <span className="font-medium">{bank_account} ({selectedBank?.name})</span>.</p>
            <CustomButton disabled={isPending} onClick={() => setShowPinForm(true)} className="w-full mx-auto">Proceed - <span className="opacity-60">Confirm Withdrawal</span></CustomButton>
          </section>
          }
    </div>
  )
}

export default ConfirmFundsWithdrawal