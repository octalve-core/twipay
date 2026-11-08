import { useEffect, useState } from 'react';
import api from '@/lib/api/axios';
import AccountSettingForm from "./AccountSettingForm";
import ImageAddIcon from "@/assets/dashboard/image-add.png";
import BackButton from "@/components/Authentication/BackButton";
import { useAuth } from "@/context/AuthContext";
import { FaCircleUser } from "react-icons/fa6";

// Preserve ErhaPay's profile presentation. The old direct ImageKit upload does
// not have a reviewed TwiPay server-side media contract; fail closed for now.
export default function AccountSettings() {
  const {user} = useAuth();
  return (
    <div className="md:bg-white w-full min-h-full rounded-[10px] md:border border-[#F0F2F5] md:py-10">
      <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
        <BackButton icon href="/dashboard/settings" />
        <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Account</p>
      </div>
      <div className="mt-14 w-full max-w-[546px] mx-auto">
        <div className="w-full max-w-[491px] mx-auto flex flex-col max-md:gap-3 md:flex-row items-center justify-between">
          <div className="hidden md:block max-w-[152px]">
            <BackButton href="/dashboard/settings" className="mb-5" />
            <h2 className="text-[#344054] font-bold">Account</h2>
            <p className="text-[#667085] text-sm">Make changes to your account here.</p>
          </div>
          <div className="relative size-[6.25rem] md:size-[7.5rem]">
            {user?.avatar ? <img src={user.avatar} alt="Your avatar" className="size-full rounded-full object-cover" /> : <FaCircleUser aria-label="Default user avatar" className="size-full text-[#667085]" />}
            {/* The old unconditional check implied verified identity. Only the KYC API can establish that status. */}
          </div>
          <div>
            <button type="button" disabled aria-describedby="avatar-unavailable" className="flex items-center rounded-lg border-[1.5px] border-[#F56630] py-2 px-3 gap-2.5 text-sm font-bold text-[#F56630] disabled:cursor-not-allowed disabled:opacity-60">
              <img src={ImageAddIcon} alt="" /> Change Photo
            </button>
            <p id="avatar-unavailable" className="text-[#667085] text-xs mt-2 max-w-[180px]">Photo updates are not available yet.</p>
          </div>
        </div>
        <AccountSettingForm />
        <StaffInvitationAcceptance />
      </div>
    </div>
  );
}

/** This optional customer-facing consent does not grant access by itself.
 * The server binds the invitation to a verified email and recent MFA, then revokes sessions.
 */
function StaffInvitationAcceptance() {
  const [items, setItems] = useState<Array<{ id: string; roleCode: string; expiresAt: string }>>([]);
  const [message, setMessage] = useState('');
  useEffect(() => { let active = true;
    api.get('/operations/staff/invitations/mine').then(res => {
      if (active) setItems(res.data.invitations ?? []);
    }).catch(() => { if (active) setItems([]); });
    return () => { active = false; };
  }, []);
  async function accept(id: string) {
    setMessage('');
    try {
      await api.post(`/operations/staff/invitations/${id}/accept`, {});
      setItems(current => current.filter(item => item.id !== id));
      setMessage('Your limited staff access was accepted. Your sessions were revoked; please sign in again.');
    } catch {
      setMessage('Acceptance was denied. Verify your email, enable MFA, complete a recent MFA challenge and try again.');
    }
  }
  if (items.length === 0 && !message) return null;
  return <section className="mt-8 rounded-lg border border-[#F0F2F5] bg-white p-5" aria-label="Staff invitations">
    <h2 className="text-[#344054] font-bold">Staff invitations</h2>
    <p className="text-sm text-[#667085] mt-2">Invitations must be approved by two different platform owners. Staff access never permits direct financial actions.</p>
    {items.map(item => <div key={item.id} className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-[#344054]">{item.roleCode.replaceAll('_',' ')} — expires {new Date(item.expiresAt).toLocaleDateString()}</span>
      <button type="button" className="rounded-md bg-[#112929] px-4 py-2 text-white" onClick={() => void accept(item.id)}>Accept staff invitation</button>
    </div>)}
    {message && <p role="status" className="mt-3 text-sm text-[#344054]">{message}</p>}
  </section>;
}
