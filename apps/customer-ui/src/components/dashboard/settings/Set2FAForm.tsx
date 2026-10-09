import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import CustomButton from "@/components/CustomButton";
import { useAuth } from "@/context/AuthContext";
import {
  beginMfaEnrollment, confirmMfaEnrollment, disableMfa,
  regenerateMfaRecoveryCodes, type MfaEnrollment,
} from "@/lib/api/authApi";

type Props = { closeModal: () => void; enabled: boolean };
type Action = "disable" | "regenerate";

export default function Set2FAForm({closeModal, enabled}: Props) {
  const {refreshSession} = useAuth();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<readonly string[] | null>(null);
  const [action, setAction] = useState<Action>("regenerate");
  const [completed, setCompleted] = useState(false);

  async function apply(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      if (recoveryCodes) return;
      if (!enabled && !enrollment) {
        if (!password) return;
        const result = await beginMfaEnrollment(password);
        setEnrollment(result);
        setPassword("");
        toast.success("Add the displayed secret to your authenticator app");
      } else if (!enabled && enrollment) {
        if (!/^\d{6}$/.test(code)) return;
        const codes = await confirmMfaEnrollment(code);
        setCode("");
        setRecoveryCodes(codes);
        setEnrollment(null);
        await refreshSession();
        toast.success("Two-factor authentication enabled");
      } else if (enabled) {
        if (!code.trim() || code.length > 32) return;
        if (action === "disable") {
          await disableMfa(code);
          setCode("");
          await refreshSession();
          setCompleted(true);
          toast.success("Two-factor authentication disabled");
        } else {
          const codes = await regenerateMfaRecoveryCodes(code);
          setCode("");
          setRecoveryCodes(codes);
          await refreshSession();
          toast.success("New recovery codes generated; old unused codes are revoked");
        }
      }
    } catch {
      toast.error("Unable to complete the security change. Check your code and try again.");
    } finally {
      setPending(false);
    }
  }

  if (recoveryCodes) return (
    <div className="w-full space-y-4" role="status">
      <p className="text-[#344054] text-sm font-medium">Save these one-time recovery codes securely.</p>
      <p className="text-[#475467] text-sm">These codes are shown only now. Store them offline; never share them or put them in a screenshot.</p>
      <ul className="rounded-md border border-[#D0D5DD] p-3 grid grid-cols-2 gap-2 text-sm font-mono select-text" aria-label="One-time MFA recovery codes">
        {recoveryCodes.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
      <CustomButton type="button" className="w-full" onClick={() => {setRecoveryCodes(null); closeModal();}}>I have saved my codes</CustomButton>
    </div>
  );

  if (completed) return (
    <div className="space-y-4"><p className="text-sm text-[#475467]">Two-factor authentication has been disabled. Re-enable it whenever you are ready.</p>
      <CustomButton type="button" onClick={closeModal} className="w-full">Close</CustomButton>
    </div>
  );

  return (
    <form onSubmit={apply} className="w-full space-y-5">
      {enabled ? (
        <>
          <p className="text-[#475467] text-sm">A valid authenticator or one-time recovery code is required for this change. If you lose your device, use a saved recovery code on the sign-in challenge. If you have neither, contact support; email alone cannot remove 2FA.</p>
          <label className="block text-sm text-[#344054] font-medium" htmlFor="mfa-action">Security action</label>
          <select id="mfa-action" value={action} onChange={e=>setAction(e.target.value as Action)} className="w-full border border-[#D0D5DD] rounded-md p-3 bg-white">
            <option value="regenerate">Generate new recovery codes</option>
            <option value="disable">Disable 2FA</option>
          </select>
        </>
      ) : enrollment ? (
        <div className="space-y-3">
          <p className="text-[#475467] text-sm">Add this secret manually in your authenticator app, then enter its 6-digit code to confirm.</p>
          <p className="break-all font-mono border border-[#D0D5DD] rounded-md p-3 text-sm select-text" aria-label="Authenticator setup secret">{enrollment.manualSecret}</p>
          <p className="text-[#475467] text-xs">Enrollment expires at {new Date(enrollment.expiresAt).toLocaleTimeString()}. The secret will not be stored by this browser.</p>
          <a className="text-[#112929] underline text-sm break-all" href={enrollment.otpauthUri}>Open authenticator app</a>
        </div>
      ) : (
        <>
          <p className="text-[#475467] text-sm">Confirm your account password to start authenticator enrollment.</p>
          <label className="block text-sm text-[#344054] font-medium" htmlFor="mfa-password">Account password</label>
          <input id="mfa-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={1} maxLength={128} className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] rounded-md" />
        </>
      )}
      {(enabled || enrollment) && (
        <>
          <label className="block text-sm text-[#344054] font-medium" htmlFor="mfa-code">{enabled ? "Authenticator or recovery code" : "6-digit authenticator code"}</label>
          <input id="mfa-code" type="text" autoComplete="one-time-code" inputMode={enabled ? "text" : "numeric"} value={code} onChange={e=>setCode(e.target.value.trim())} required minLength={6} maxLength={32} className="w-full outline-0 bg-white py-2.5 px-3.5 border border-[#D0D5DD] rounded-md" />
        </>
      )}
      <CustomButton disabled={pending || (enabled ? code.trim().length < 6 : enrollment ? !/^\d{6}$/.test(code) : !password)} isLoading={pending} className="w-full">
        {enabled ? action === "disable" ? "Disable 2FA" : "Regenerate recovery codes" : enrollment ? "Confirm authenticator" : "Set up authenticator"}
      </CustomButton>
    </form>
  );
}
