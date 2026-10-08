import ChangePasswordModal from "./ChangePasswordModal"
import UpdatePhoneModal from "./UpdatePhoneModal"
import ChangeTxnPinModal from "./ChangeTxnPinModal"
import Set2FAModal from "./set2FAModal"
import BackButton from "@/components/Authentication/BackButton"

const SecuritySettings = () => {

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
                <ChangePasswordModal />
                <UpdatePhoneModal />
                <ChangeTxnPinModal />
                <Set2FAModal />
            </div>
          </div>
        </section>
    </div>
  )
}

export default SecuritySettings