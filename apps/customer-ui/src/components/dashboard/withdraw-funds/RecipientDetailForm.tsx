import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import CustomButton from '@/components/CustomButton';
import { Check, ChevronDown } from 'lucide-react';
import { Popover,PopoverContent,PopoverTrigger } from '@/components/ui/popover';
import { Command,CommandInput,CommandList,CommandEmpty,CommandGroup,CommandItem } from '@/components/ui/command';
import useWithdrawFundsStore from '@/stores/useWithdrawFunds';
import { nairaToMinor } from '@/lib/api/dashboard-apis/funding';
import { listTransferBanks, resolveBankAccount, type PayoutProvider } from '@/lib/api/dashboard-apis/transfers';

const sandboxEnabled = import.meta.env.VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED === 'true';

/** Original ErhaPay bank recipient page; uses verified provider bank directory. */
const RecipientDetailForm = () => {
  const {amount,update,provider: savedProvider} = useWithdrawFundsStore();
  const [provider,setProvider]=useState<PayoutProvider>(savedProvider);
  const [bankCode,setBankCode]=useState('');
  const [bankDropdownOpen,setBankDropdownOpen]=useState(false);
  const {data:banks=[],isLoading:loadingBanks,error:bankError} = useQuery({
    queryKey:['twipay','transfer-banks',provider],
    queryFn:()=>listTransferBanks(provider),
    enabled:sandboxEnabled,
    staleTime:10*60_000,
    retry:1,
  });
  const [accountNumber,setAccountNumber]=useState('');
  const [narration,setNarration]=useState('Wallet bank transfer');
  const [verified,setVerified]=useState<{accountName:string;bankName?:string}|null>(null);
  const [busy,setBusy]=useState(false);
  const verificationGeneration=useRef(0);
  const [error,setError]=useState('');
  const fieldStyle='w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] text-sm text-[#344054]';
  function changed(){verificationGeneration.current+=1;setVerified(null);setError('');}
  async function verify() {
    if (busy || !sandboxEnabled) return;
    const generation=++verificationGeneration.current;
    const requestProvider=provider, requestBank=bankCode.trim(), requestNumber=accountNumber.trim();
    setBusy(true);setError('');setVerified(null);
    try {
      nairaToMinor(amount);
      if (!banks.some(bank=>bank.bankCode===requestBank)) throw new Error('Select a bank from the provider directory');
      const account=await resolveBankAccount(requestProvider,requestBank,requestNumber);
      if (generation !== verificationGeneration.current) return;
      setVerified({accountName:account.accountName,bankName:account.bankName});
      toast.success('Bank account details verified');
    } catch (e) {if (generation === verificationGeneration.current) setError(e instanceof Error?e.message:'Unable to verify this account');}
    finally {setBusy(false);}
  }
  function proceed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!sandboxEnabled || busy || !verified) return;
    if(narration.trim().length<3 || narration.trim().length>120){setError('Narration must contain 3–120 characters');return;}
    update({step:3,provider,selectedBank:{bankCode:bankCode.trim(),name:verified.bankName??banks.find(bank=>bank.bankCode===bankCode.trim())?.name??`Bank code ${bankCode.trim()}`},
      bank_account:accountNumber,accountName:verified.accountName,note:narration.trim()});
  }
  return <form onSubmit={proceed} className="w-full mt-14 md:mt-5">
    <div className="w-full">
      <label className="text-sm text-[#344054] font-medium" htmlFor="payout-provider">Payment provider</label>
      <select id="payout-provider" className={fieldStyle} value={provider} onChange={e=>{setProvider(e.target.value as PayoutProvider);setBankCode('');changed()}}>
        <option value="paystack">Paystack</option><option value="monnify">Monnify</option>
      </select>
    </div>
    <div className="w-full mt-5">
      <label className="text-sm text-[#344054] font-medium" htmlFor="payout-bank-code">Bank name</label>
      <Popover open={bankDropdownOpen} onOpenChange={setBankDropdownOpen}>
        <PopoverTrigger asChild>
          <button id="payout-bank-code" type="button" aria-expanded={bankDropdownOpen} aria-label="Select bank" disabled={!sandboxEnabled||loadingBanks||!!bankError}
            className="w-full !h-12 mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none hover:border-[#112929] font-normal text-[#344054] flex items-center justify-between text-sm disabled:opacity-55">
            <span>{banks.find(bank=>bank.bankCode===bankCode)?.name??(loadingBanks?'Loading banks…':'Select bank')}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[90vw] md:w-[360px]">
          <Command>
            <CommandInput placeholder="Search banks..." />
            <CommandList className="w-full px-3.5">
              <CommandEmpty>No bank found.</CommandEmpty>
              <CommandGroup className="px-0">
                {banks.map(bank=><CommandItem key={bank.bankCode} value={`${bank.name} ${bank.bankCode}`}
                  onSelect={()=>{setBankCode(bank.bankCode);changed();setBankDropdownOpen(false)}}
                  className="text-[#344054] justify-between">
                  <span>{bank.name}</span><Check className={`mr-2 h-4 w-4 ${bankCode===bank.bankCode?'opacity-100':'opacity-0'}`}/>
                </CommandItem>)}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {bankError && <p role="alert" className="text-red-600 text-sm mt-1">Bank directory is unavailable. Please retry later; manual or guessed bank codes are not accepted.</p>}
    </div>
    <div className="w-full mt-5">
      <label className="text-sm text-[#344054] font-medium" htmlFor="payout-account">Account number</label>
      <input id="payout-account" className={fieldStyle} value={accountNumber} onChange={e=>{setAccountNumber(e.target.value.replace(/\D/g,'').slice(0,10));changed()}} inputMode="numeric" autoComplete="off" maxLength={10} placeholder="10-digit account number" />
    </div>
    <div className="w-full mt-5">
      <label className="text-sm text-[#344054] font-medium" htmlFor="payout-narration">Narration</label>
      <input id="payout-narration" className={fieldStyle} value={narration} onChange={e=>setNarration(e.target.value)} maxLength={120} />
    </div>
    {verified && <p className="text-sm text-[#039855] mt-3" role="status">Verified beneficiary: <strong>{verified.accountName}</strong>{verified.bankName?` (${verified.bankName})`:''}</p>}
    {error && <p className="text-red-600 text-sm mt-3" role="alert">{error}</p>}
    {!sandboxEnabled && <p role="status" className="mt-5 text-sm text-[#717171]">Bank payouts remain unavailable until the sandbox and security qualification is complete. No money can be sent from this screen.</p>}
    <CustomButton type="button" disabled={!sandboxEnabled || busy || loadingBanks || !!bankError || !banks.some(bank=>bank.bankCode===bankCode) || !/^\d{10}$/.test(accountNumber)} onClick={()=>void verify()} className="mt-7 w-full">
      {busy?'Verifying account…':'Verify account'}
    </CustomButton>
    <CustomButton disabled={!sandboxEnabled || busy || !verified} className="mt-2 w-full">Proceed - <span className="opacity-60">Confirm</span></CustomButton>
  </form>;
};
export default RecipientDetailForm;
