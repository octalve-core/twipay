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
        <h1 className="text-[#101928] font-medium md:text-2xl">Good {getTimeOfDay()}, <span className="capitalize">{user?.username}</span>!</h1>
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


