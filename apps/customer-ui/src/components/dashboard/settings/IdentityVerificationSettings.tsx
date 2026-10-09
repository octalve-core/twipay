import { useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import BackButton from "@/components/Authentication/BackButton";
import {
  continueIdentityVerification,
  getIdentityVerifications,
  initiateIdentityVerification,
  type IdentityInitiation,
  type IdentityType,
} from "@/lib/api/kycApi";

const inputClass = "w-full outline-0 bg-white p-4 border border-[#D0D5DD] shadow-[#1018280D] text-[#344054] text-sm rounded-md mt-1 focus:border-[#112929]";

// The provider's verification methods are dynamic; never invent an SMS method.
// Only accept clearly named string methods returned by the provider, and do not
// store identity numbers, consent text or OTPs in localStorage/sessionStorage.
function providerMethods(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length >= 2 && item.trim().length <= 40))];
}

export default function IdentityVerificationSettings() {
  const [type, setType] = useState<IdentityType>("BVN");
  const [identifier, setIdentifier] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [verification, setVerification] = useState<IdentityInitiation | null>(null);
  const [method, setMethod] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"new" | "method" | "otp" | "status">("new");
  const requestKey = useRef<{operation: string; key: string} | null>(null);
  const listing = useQuery({queryKey: ["twipay", "kyc", "verifications"], queryFn: getIdentityVerifications});

  function idempotencyKey(operation: string): string {
    if (requestKey.current?.operation !== operation) requestKey.current = {operation, key: crypto.randomUUID()};
    return requestKey.current.key;
  }
  function resetKey() { requestKey.current = null; }
  function clearInput() { setIdentifier(""); setConsent(false); resetKey(); }

  async function initiate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !/^\d{11}$/.test(identifier) || !consent) return;
    setPending(true);
    try {
      const result = await initiateIdentityVerification({type, identifier, consent: true, idempotencyKey: idempotencyKey(`initiate:${type}:${identifier}`)});
      setVerification(result);
      clearInput();
      void listing.refetch();
      if (result.status === "AWAITING_CONSENT") {
        const methods = providerMethods(result.verificationMethods);
        setMethod(methods[0] ?? "");
        setStep(methods.length ? "method" : "status");
      } else {
        setStep("status");
      }
      if (result.status === "PENDING") toast.message("Verification pending; its outcome must be confirmed before account eligibility changes.");
    } catch {
      // Retain the logical attempt's idempotency key for a byte-identical retry.
      toast.error("Verification could not be initiated. Check your connection before retrying.");
    } finally { setPending(false); }
  }

  async function submitMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !verification || !method) return;
    setPending(true);
    try {
      const response = await continueIdentityVerification({verificationId: verification.verificationId, action: "REQUEST_OTP", verificationMethod: method, idempotencyKey: idempotencyKey(`request:${verification.verificationId}:${method}`)});
      resetKey();
      setVerification({...verification, status: response.status});
      setStep(response.status === "PENDING" ? "otp" : "status");
      void listing.refetch();
    } catch {
      toast.error("Unable to request verification. You can retry this same request.");
    } finally {setPending(false);}
  }

  async function submitOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !verification || !/^\d{4,10}$/.test(otp)) return;
    setPending(true);
    try {
      const result = await continueIdentityVerification({verificationId: verification.verificationId, action: "SUBMIT_OTP", otp, idempotencyKey: idempotencyKey(`submit:${verification.verificationId}:${otp}`)});
      setOtp(""); resetKey();
      setVerification({...verification, status: result.status});
      setStep("status");
      void listing.refetch();
      if (result.status === "VERIFIED") toast.success("Identity verification confirmed");
    } catch {
      toast.error("The verification response is uncertain. Check the verification status before submitting another code.");
      setOtp(""); resetKey();
      setStep("status");
    } finally {setPending(false);}
  }

  return (
    <div className="md:bg-white w-full min-h-full rounded-[10px] md:border border-[#F0F2F5] md:py-10">
      <div className="w-full max-w-[546px] mx-auto px-4 md:px-0 mt-10 md:mt-0">
        <BackButton href="/dashboard/settings" className="mb-5" />
        <h1 className="text-[#344054] font-bold text-2xl">Identity verification</h1>
        <p className="text-[#727884] text-sm mt-1">Verify your identity to access more of your TwiPay account.</p>

        {step === "new" && (
          <form onSubmit={initiate} className="mt-8 space-y-5">
            <div>
              <label htmlFor="kyc-type" className="text-[#344054] text-sm font-medium">Identity document</label>
              <select id="kyc-type" value={type} onChange={event => {setType(event.target.value as IdentityType); resetKey();}} className={inputClass}>
                <option value="BVN">Bank Verification Number (BVN)</option>
                <option value="NIN">National Identification Number (NIN)</option>
              </select>
            </div>
            <div>
              <label htmlFor="kyc-number" className="text-[#344054] text-sm font-medium">11-digit {type}</label>
              <input id="kyc-number" name="identity-identifier" type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]{11}" maxLength={11} required value={identifier} onChange={event => {setIdentifier(event.target.value); resetKey();}} className={inputClass} />
              <p className="text-xs text-[#667085] mt-2">Your details are used to verify your identity with our verification partner.</p>
            </div>
            <label className="flex gap-3 items-start text-sm text-[#475467]">
              <input type="checkbox" className="mt-1" checked={consent} onChange={event => {setConsent(event.target.checked); resetKey();}} required />
              <span>I authorize TwiPay to send this identity number to its contracted verification provider for identity verification.</span>
            </label>
            <button type="submit" disabled={pending || !consent || !/^\d{11}$/.test(identifier)} className="w-full md:w-auto rounded-lg bg-[#112929] text-white py-3 px-6 font-medium disabled:opacity-50">{pending ? "Submitting…" : "Verify identity"}</button>
          </form>
        )}

        {step === "method" && verification && (
          <form onSubmit={submitMethod} className="mt-8 space-y-5">
            <h2 className="font-medium text-[#344054]">Provider verification method</h2>
            <p className="text-sm text-[#667085]">Choose how you would like to receive your verification code.</p>
            <select aria-label="Provider verification method" value={method} onChange={event => {setMethod(event.target.value); resetKey();}} className={inputClass}>
              {providerMethods(verification.verificationMethods).map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <button disabled={pending || !method} className="rounded-lg bg-[#112929] text-white py-3 px-6 disabled:opacity-50">{pending ? "Requesting…" : "Request verification code"}</button>
          </form>
        )}

        {step === "otp" && verification && (
          <form onSubmit={submitOtp} className="mt-8 space-y-5">
            <label htmlFor="kyc-otp" className="block text-[#344054] font-medium text-sm">Verification code from your provider</label>
            <input id="kyc-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,10}" minLength={4} maxLength={10} required className={inputClass} value={otp} onChange={event => {setOtp(event.target.value); resetKey();}} />
            <button disabled={pending || !/^\d{4,10}$/.test(otp)} className="rounded-lg bg-[#112929] text-white py-3 px-6 disabled:opacity-50">{pending ? "Confirming…" : "Confirm verification"}</button>
          </form>
        )}

        {step === "status" && verification && (
          <div role="status" className="mt-8 rounded-lg border border-[#D0D5DD] p-4 space-y-3 text-sm">
            <p className="font-medium text-[#344054]">Verification status: {verification.status}</p>
            <p className="text-[#667085]">{verification.status === "VERIFIED" ? "Your verification was confirmed by the provider." : "Verification may require provider processing. Do not submit a new identity number just because a response is pending."}</p>
            <button type="button" onClick={() => void listing.refetch()} className="text-[#112929] underline">Refresh verification history</button>
            <button type="button" onClick={() => {setVerification(null); setStep("new"); resetKey();}} className="block text-[#112929] underline">Start another verification</button>
          </div>
        )}

        <section className="mt-10 border-t border-[#F0F2F5] pt-6">
          <h2 className="font-semibold text-[#344054]">Verification history</h2>
          {listing.isLoading && <p className="text-sm text-[#667085] mt-3">Loading verification history…</p>}
          {listing.isError && <p role="alert" className="text-sm text-red-600 mt-3">History could not be loaded. No verification result should be assumed.</p>}
          {listing.data?.length === 0 && <p className="text-sm text-[#667085] mt-3">No verification attempts recorded.</p>}
          <ul className="space-y-2 mt-3" aria-label="Identity verification history">
            {listing.data?.map(item => (
              <li key={item.id} className="rounded-lg border border-[#F0F2F5] px-4 py-3 text-sm flex items-center justify-between gap-4">
                <span className="text-[#344054]">{item.type} ••••{item.identifierLast4}</span>
                <span className="text-[#667085]" aria-label={`Verification status ${item.status}`}>{item.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
