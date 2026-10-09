import { type FormEvent, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import CustomButton from "@/components/CustomButton";
import { useAuth } from "@/context/AuthContext";
import { updateProfile } from "@/lib/api/authApi";

// Keep ErhaPay's original account-form layout. Only fields supported by the
// verified TwiPay PATCH /auth/me contract are mutable at this checkpoint.
const fieldClass = "w-full outline-0 bg-white p-4 border border-[#D0D5DD] shadow-[#1018280D] text-[#344054] text-sm rounded-md mt-1 focus:border-[#112929] disabled:pointer-events-none disabled:bg-[#F0F2F5] disabled:text-[#98A2B3] transition";

export default function AccountSettingForm() {
  const { user, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [stateRegion, setStateRegion] = useState("");

  useEffect(() => {
    setGivenName(user?.firstname ?? "");
    setFamilyName(user?.lastname ?? "");
    setCountryCode(user?.country ?? "");
    setStateRegion(user?.state ?? "");
  }, [user?.id, user?.firstname, user?.lastname, user?.country, user?.state]);

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      try {
        await refreshSession();
        toast.success("Profile updated successfully");
        navigate("/dashboard/settings");
      } catch {
        toast.error("Profile saved, but we could not confirm your session. Please sign in again.");
        navigate("/auth/login");
      }
    },
    onError: () => toast.error("Unable to update your profile. Please try again."),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending || !user) return;
    const first = givenName.trim();
    const last = familyName.trim();
    if (first.length < 1 || first.length > 100 || last.length < 1 || last.length > 100) {
      toast.error("Enter a first and last name of at most 100 characters each.");
      return;
    }
    const code = countryCode.trim().toUpperCase();
    const region = stateRegion.trim();
    if (code && !/^[A-Z]{2}$/.test(code)) { toast.error("Enter a two-letter country code (for example, NG)."); return; }
    if (region.length > 100) { toast.error("State or region must be at most 100 characters."); return; }
    if (first === user.firstname && last === user.lastname && code === user.country && region === user.state) return;
    mutation.mutate({ givenName: first, familyName: last, countryCode: code || null, stateRegion: region || null });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 md:mt-14">
      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="w-full">
          <label className="text-[#344054] text-sm font-medium" htmlFor="firstname">First name</label>
          <input id="firstname" name="givenName" type="text" autoComplete="given-name" maxLength={100} required value={givenName} onChange={event => setGivenName(event.target.value)} className={fieldClass} />
        </div>
        <div className="w-full">
          <label className="text-[#344054] text-sm font-medium" htmlFor="lastname">Last name</label>
          <input id="lastname" name="familyName" type="text" autoComplete="family-name" maxLength={100} required value={familyName} onChange={event => setFamilyName(event.target.value)} className={fieldClass} />
        </div>
      </div>
      <div className="w-full mt-5">
        <label className="text-[#344054] text-sm font-medium" htmlFor="email">Email address</label>
        <input id="email" type="email" value={user?.email ?? ""} disabled className={fieldClass} />
      </div>
      <div className="w-full mt-5">
        <label className="text-[#344054] text-sm font-medium" htmlFor="country">Country code (optional)</label>
        <input id="country" name="countryCode" type="text" autoComplete="country" placeholder="NG" maxLength={2} pattern="[A-Za-z]{2}" value={countryCode} onChange={event => setCountryCode(event.target.value.toUpperCase())} className={fieldClass} />
      </div>
      <div className="w-full mt-5">
        <label className="text-[#344054] text-sm font-medium" htmlFor="state">State or region (optional)</label>
        <input id="state" name="stateRegion" type="text" autoComplete="address-level1" maxLength={100} value={stateRegion} onChange={event => setStateRegion(event.target.value)} className={fieldClass} />
      </div>
      <p className="text-[#667085] text-xs mt-3">Your location is optional profile information. It does not verify your identity or change account limits. Email and phone changes require a separate verified-contact process.</p>
      <div className="mt-5 w-full flex items-center justify-end">
        <CustomButton isLoading={mutation.isPending} disabled={mutation.isPending || !user || (givenName.trim() === user.firstname && familyName.trim() === user.lastname && countryCode.trim().toUpperCase() === user.country && stateRegion.trim() === user.state)} className="w-full md:w-[120px]">Save</CustomButton>
      </div>
    </form>
  );
}
