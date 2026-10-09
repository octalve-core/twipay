import ChangePasswordModal from "./ChangePasswordModal"
import UpdatePhoneModal from "./UpdatePhoneModal"
import ChangeTxnPinModal from "./ChangeTxnPinModal"
import Set2FAModal from "./set2FAModal"
import BackButton from "@/components/Authentication/BackButton"
import { useEffect, useState } from "react"
import { listAccountSessions, revokeOtherAccountSessions, getGoogleAvailability, getGoogleLinkStatus, startGoogleAccountLink, getPasswordEnrollmentStatus } from "@/lib/api/authApi"
import { toast } from "sonner"
import PasswordEnrollmentForm from "./PasswordEnrollmentForm"

const SecuritySettings = () => {
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof listAccountSessions>>['sessions']>([]);
  const [sessionsUnavailable, setSessionsUnavailable] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [googlePassword, setGooglePassword] = useState('');
  const [googlePending, setGooglePending] = useState(false);
  const [hasPassword, setHasPassword] = useState<boolean|null>(null);
  const [credentialStatusUnavailable,setCredentialStatusUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    void getPasswordEnrollmentStatus().then(result => {if(active)setHasPassword(result.hasPassword);}).catch(()=>{if(active)setCredentialStatusUnavailable(true);});
    return ()=>{active=false;};
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.all([getGoogleAvailability(), getGoogleLinkStatus()]).then(([available, linked]) => {
      if (active) { setGoogleEnabled(available.enabled); setGoogleLinked(linked.linked); }
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const linkGoogle = async () => {
    if (googlePending || !googlePassword) return;
    setGooglePending(true);
    try {
      const result = await startGoogleAccountLink(googlePassword);
      setGooglePassword('');
      window.location.assign(result.authorizationUrl);
    } catch { toast.error('We couldn’t connect Google. Check your password and try again.'); setGooglePending(false); }
  };
  useEffect(() => {
    let active = true;
    void listAccountSessions().then((data) => { if (active) setSessions(data.sessions); })
      .catch(() => { if (active) setSessionsUnavailable(true); });
    return () => { active = false; };
  }, []);
  const revokeOther = async () => {
    if (!currentPassword || pending) return;
    setPending(true);
    try {
      const result = await revokeOtherAccountSessions(currentPassword);
      setCurrentPassword('');
      const latest = await listAccountSessions();
      setSessions(latest.sessions);
      toast.success(`${result.revoked} other session(s) signed out.`);
    } catch { toast.error('We couldn’t sign out your other sessions. Check your password and try again.'); }
    finally { setPending(false); }
  };

  return (
    <div className="w-full mx-auto min-h-full md:grid place-items-center">
        <section className="md:bg-white w-full max-w-[478px] mx-auto rounded-[10px] md:border border-[#F0F2F5] md:p-[46px]">
          <div className="max-w-[386px]">
            <div className="flex items-center mb-3 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
              <BackButton icon href="/dashboard/settings"/>
              <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Security</p>
            </div>

            <div className="md:text-center hidden md:block">
                <BackButton href="/dashboard/settings" className="mb-8" />
                <h1 className="text-[#112929] font-bold text-3xl text-left">Security</h1>
                <p className="text-left text-[#475467] mt-1 text-sm">Make security changes to your account.</p>
            </div>

            <div className="flex flex-col gap-[17px] mt-10 md:mt-[17px] w-full">
                {credentialStatusUnavailable && <p role="status" className="text-[#667085] text-sm">Account security options are temporarily unavailable. Please try again later.</p>}
                {hasPassword && <ChangePasswordModal />}
                <UpdatePhoneModal />
                {hasPassword && <ChangeTxnPinModal />}
                {hasPassword && <Set2FAModal />}
                {hasPassword===false && <PasswordEnrollmentForm />}
                {googleEnabled && hasPassword && <section className="mt-5 pt-5 border-t border-[#E9E9E9]" aria-labelledby="google-account-title">
                  <h2 id="google-account-title" className="text-[#112929] font-semibold text-base">Google sign-in</h2>
                  {googleLinked ? <p className="text-sm text-[#667085] mt-2">Google is connected to your TwiPay account.</p>
                    : <>
                      <p className="text-sm text-[#667085] mt-2">Connect your Google account to sign in more easily. Confirm your TwiPay password first.</p>
                      <label htmlFor="google-account-password" className="block text-sm text-[#344054] mt-3">Current password</label>
                      <input id="google-account-password" className="mt-1 w-full border border-[#D0D5DD] rounded-md px-3 py-2" type="password" autoComplete="current-password" value={googlePassword} onChange={(event) => setGooglePassword(event.target.value)} />
                      <button type="button" className="mt-3 rounded-md bg-[#112929] px-4 py-2 text-white text-sm disabled:opacity-50" disabled={!googlePassword || googlePending} onClick={() => void linkGoogle()}>Connect Google</button>
                    </>}
                </section>}
                <section className="mt-5 pt-5 border-t border-[#E9E9E9]" aria-labelledby="active-sessions-title">
                  <h2 id="active-sessions-title" className="text-[#112929] font-semibold text-base">Signed-in devices</h2>
                  <p className="text-sm text-[#667085] mt-1">Review sessions on your account. You can sign out other devices here.</p>
                  {sessionsUnavailable ? <p role="status" className="text-sm mt-3 text-[#667085]">Session details are temporarily unavailable.</p> :
                    <ul className="mt-3 flex flex-col gap-2">
                      {sessions.map((session) => <li className="text-sm border border-[#E9E9E9] rounded-md p-3" key={session.id}>
                        <p className="font-medium break-words">{session.userAgent || 'Unrecognized browser'} {session.current ? '· This device' : ''}</p>
                        <p className="text-[#667085] mt-1">Last active: {new Date(session.lastSeenAt).toLocaleString()}</p>
                      </li>)}
                    </ul>}
                  {sessions.some((session) => !session.current) && <div className="mt-4">
                    <label htmlFor="other-session-password" className="text-sm text-[#344054] font-medium">Current password</label>
                    <input id="other-session-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-2 w-full border border-[#D0D5DD] rounded-md px-3 py-2" />
                    <button type="button" onClick={() => void revokeOther()} disabled={pending || !currentPassword} className="mt-3 rounded-md bg-[#112929] px-4 py-2 text-white text-sm disabled:opacity-50">Sign out other devices</button>
                  </div>}
                </section>
            </div>
          </div>
        </section>
    </div>
  )
}

export default SecuritySettings