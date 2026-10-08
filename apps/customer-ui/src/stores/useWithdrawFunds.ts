import { create } from 'zustand';
import type { BankPayoutResponse, PayoutProvider } from '@/lib/api/dashboard-apis/transfers';

type Bank = { bankCode: string; name: string };
type WithdrawState = {
  step: number;
  provider: PayoutProvider;
  selectedBank: Bank | null;
  bank_account: string;
  accountName: string;
  amount: string;
  note: string;
  txnResult: BankPayoutResponse | null;
  update: (fields: Partial<Omit<WithdrawState,'update'|'reset'>>) => void;
  reset: () => void;
};
const initial = {
  step: 1, provider:'paystack' as const, selectedBank: null, bank_account:'',
  accountName:'', amount:'',note:'',txnResult:null,
};
const useWithdrawFundsStore = create<WithdrawState>((set)=>({
  ...initial,
  update:(fields)=>set(state=>({...state,...fields})),
  reset:()=>set({...initial}),
}));
export default useWithdrawFundsStore;
