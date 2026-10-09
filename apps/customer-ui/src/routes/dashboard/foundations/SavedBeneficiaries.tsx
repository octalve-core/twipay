import { useEffect, useState, type FormEvent } from 'react';
import { FoundationPage, FoundationPanel, FoundationLink } from '@/components/design-system/ErhaFoundationUI';
import { listSavedBeneficiaries, saveTransferBeneficiary, removeSavedBeneficiary, renameSavedBeneficiary, listTransferBanks, type SavedBeneficiary, type PayoutProvider, type BankListEntry } from '@/lib/api/dashboard-apis/transfers';

const sandboxEnabled = import.meta.env.VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED === 'true';
export default function SavedBeneficiaries() {
  const [entries,setEntries]=useState<SavedBeneficiary[]>([]);
  const [provider,setProvider]=useState<PayoutProvider>('paystack');
  const [banks,setBanks]=useState<BankListEntry[]>([]);
  const [bankCode,setBankCode]=useState('');
  const [account,setAccount]=useState('');
  const [nickname,setNickname]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const refresh=async()=>{const records=await listSavedBeneficiaries();setEntries(records)};
  useEffect(()=>{let active=true;void listSavedBeneficiaries().then(records=>{if(active)setEntries(records)})
    .catch(()=>{if(active)setError('Unable to load saved bank accounts.')})
    .finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
  useEffect(()=>{if(!sandboxEnabled)return;let active=true;setBanks([]);setBankCode('');
    void listTransferBanks(provider).then(records=>{if(active)setBanks(records)}).catch(()=>{if(active)setError('Unable to load the bank directory.')});
    return()=>{active=false};},[provider]);
  async function add(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!sandboxEnabled||busy||!banks.some(bank=>bank.bankCode===bankCode)||!/^[0-9]{10}$/.test(account))return;
    setBusy(true);setError('');try{
      await saveTransferBeneficiary({provider,bankCode,accountNumber:account,...(nickname.trim()?{nickname:nickname.trim()}: {})});
      setAccount('');setNickname('');await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Unable to save this recipient')}
    finally{setBusy(false)}
  }
  async function rename(entry:SavedBeneficiary){
    const next=window.prompt('Recipient nickname (leave blank to use the verified name):',entry.nickname??'');
    if(next===null)return;
    if(next.trim().length>60){setError('Nickname must be at most 60 characters');return;}
    setBusy(true);setError('');try{await renameSavedBeneficiary(entry.id,next.trim()||null);await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Unable to update nickname')}finally{setBusy(false)}
  }
  async function remove(id:string){
    if(!window.confirm('Remove this account from your saved recipients? Previous transfer records will remain available.'))return;
    setBusy(true);setError('');try{await removeSavedBeneficiary(id);await refresh()}
    catch(e){setError(e instanceof Error?e.message:'Unable to remove this recipient')}
    finally{setBusy(false)}
  }
  const field='w-full mt-2 p-3 border border-[#D0D5DD] rounded-lg bg-white text-sm';
  return <FoundationPage title="Saved beneficiaries" description="Manage the bank accounts you have saved for future transfers.">
    <FoundationPanel title="Your saved accounts" description="Account details are checked with the provider before saving. Only masked numbers are shown here.">
      {loading?<p role="status">Loading saved recipients…</p>:
        entries.length===0?<p>No bank accounts saved yet.</p>:<ul className="space-y-3">
          {entries.map(entry=><li key={entry.id} className="border border-[#D0D5DD] p-3 rounded-lg flex justify-between gap-4 items-center">
            <span><strong className="block">{entry.nickname||entry.accountName}</strong><span className="block text-sm text-[#667085]">{entry.accountName} · Bank {entry.bankCode} · {entry.accountNumberMasked}</span></span>
            <span className="flex flex-col gap-2"><button type="button" disabled={busy} onClick={()=>void rename(entry)} className="underline text-sm">Rename</button><button type="button" disabled={busy} onClick={()=>void remove(entry.id)} className="underline text-sm text-[#B42318]">Remove</button></span>
          </li>)}
        </ul>}
    </FoundationPanel>
    <FoundationPanel title="Save a bank account" description="Confirm your recipient’s bank details before saving them.">
      {!sandboxEnabled?<p role="status">Saving bank accounts is unavailable until provider verification has been qualified.</p>:
      <form onSubmit={event=>void add(event)} className="max-w-md space-y-4">
        <label className="block text-sm">Provider<select className={field} value={provider} onChange={e=>setProvider(e.target.value as PayoutProvider)}><option value="paystack">Paystack</option><option value="monnify">Monnify</option></select></label>
        <label className="block text-sm">Bank<select className={field} required value={bankCode} onChange={e=>setBankCode(e.target.value)}><option value="">Select a bank</option>{banks.map(bank=><option value={bank.bankCode} key={bank.bankCode}>{bank.name}</option>)}</select></label>
        <label className="block text-sm">Account number<input className={field} required value={account} inputMode="numeric" autoComplete="off" maxLength={10} onChange={e=>setAccount(e.target.value.replace(/\D/g,'').slice(0,10))}/></label>
        <label className="block text-sm">Nickname (optional)<input className={field} value={nickname} maxLength={60} onChange={e=>setNickname(e.target.value)}/></label>
        <button disabled={busy||!/^[0-9]{10}$/.test(account)||!banks.some(bank=>bank.bankCode===bankCode)} type="submit" className="w-full p-3 rounded-lg bg-[#112929] text-white disabled:opacity-50">{busy?'Saving…':'Verify and save'}</button>
      </form>}
      {error&&<p className="text-sm text-[#B42318] mt-3" role="alert">{error}</p>}
      <p className="mt-4 text-sm text-[#667085]">To send a bank transfer, re-enter and review the recipient details. Saved-account selection is not yet enabled.</p>
      <FoundationLink to="/dashboard/withdraw-funds" title="Bank transfers" description="Review transfer availability and recipient details."/>
    </FoundationPanel>
  </FoundationPage>;
}
