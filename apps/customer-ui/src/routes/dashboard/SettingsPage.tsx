import BackButton from "@/components/Authentication/BackButton";
import Settings from "@/components/dashboard/settings/Settings"
import useIsMobile from "@/hooks/useIsMobile";

const SettingsPage = () => {
  const isMobile = useIsMobile();

  return (
    <div className="md:pt-5 max-w-[588px] mx-auto">
        <BackButton className="mb-10 md:mb-8 mt-2" icon={isMobile} href="/dashboard"/>
        <h1 className="text-[#344054] md:text-[#112929] font-bold text-[28px]">Settings</h1>
        <p className="text-[#667085] text-sm">Make changes to your account</p>
        <Settings />
    </div>
  )
}

export default SettingsPage;