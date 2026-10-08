import BackButton from "@/components/Authentication/BackButton";
import ActionButtons from "@/components/dashboard/virtual-card/ActionButtons"
import Card from "@/components/dashboard/virtual-card/Card"
import TransactionDetails from "@/components/dashboard/virtual-card/TransactionHistory"

const VirtualCard = () => {

  return (
    <div className="w-full flex justify-center">
        <section className="flex flex-col w-full max-w-[360px] mx-auto">
            <div className="flex items-center mb-7 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
                <BackButton icon href="/dashboard"/>
                <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Virtual card</p>
            </div>

            <div className="hidden md:block">
                <BackButton href="/dashboard" className="mb-8" />  
                <h1 className="text-[#112929] font-bold text-[28px]">Virtual card</h1>
                <p className="text-[#727884]  text-sm mt-1">Access a virtual card that works.</p>
            </div>

            <Card />
            <ActionButtons />
            <TransactionDetails />
        </section>
    </div>
  )
}

export default VirtualCard