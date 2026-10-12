import { Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import BalanceCard from "./BalanceCard"
import Campaign from "./Campaign"
import CreditCard from "./CreditCard"
import TransactionHistory from "./History"
import OtherServices from "./OtherServices"
import QuickActions from "./QuickActions"
import ServicesList from "./ServicesList"
import { getTimeOfDay } from "@/lib/utils"

const Dashboard = () => {
  const {user} = useAuth()

  return (
    <div className="min-h-full">
        <h1 className="text-[#101928] font-medium md:text-2xl">Good {getTimeOfDay()}, <span className="capitalize">{user?.firstname || 'there'}</span>!</h1>
        {user && (user.identityVerificationStatus !== 'VERIFIED' || user.transactionPinStatus !== 'SET') && (
          <section aria-label="Account setup reminders" className="mt-5 flex flex-wrap gap-3">
            {user.identityVerificationStatus !== 'VERIFIED' &&
              <Link to="/dashboard/settings/identity-verification" className="block rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm text-[#344054] hover:border-[#112929] focus-visible:outline-2 focus-visible:outline-[#112929]">
                <strong className="block text-[#101828]">{user.identityVerificationStatus === 'IN_PROGRESS' ? 'Continue identity verification' : 'Complete your identity verification'}</strong>
                <span>Review the next steps for your account.</span>
              </Link>}
            {user.transactionPinStatus !== 'SET' &&
              <Link to="/dashboard/settings/security-overview" className="block rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm text-[#344054] hover:border-[#112929] focus-visible:outline-2 focus-visible:outline-[#112929]">
                <strong className="block text-[#101828]">{user.transactionPinStatus === 'NOT_AVAILABLE' ? 'Transaction PIN setup' : 'Set up your transaction PIN'}</strong>
                <span>{user.transactionPinStatus === 'NOT_AVAILABLE' ? 'This security option is being prepared.' : 'Protect future payments with a PIN.'}</span>
              </Link>}
          </section>
        )}
        <div className="grid grid-cols-8 gap-5 mt-5 md:mt-11 relative">
          {/* For smaller screens */}
            <section className="md:hidden flex items-center gap-5 w-[90vw] hide-scrollbar">
              <div className="w-[282px] shrink-0">
                <BalanceCard />
              </div>
              <div className="w-[308px] shrink-0">
                <CreditCard />
              </div>
            </section>
            
            <div className="md:hidden col-span-full">
                <QuickActions />
                <OtherServices />
                <Campaign />
            </div>

            {/* For larger screens */}
            <div className="hidden md:block md:col-span-5">
                <BalanceCard />
                <QuickActions />
                <ServicesList />
                <OtherServices />
                <Campaign />
            </div>

            <div className="max-md:hidden col-span-full md:col-span-3 sticky top-0 h-fit">
              <CreditCard />
              <TransactionHistory />
            </div>

        </div>
    </div>
  )
}

export default Dashboard


