import BackButton from "@/components/Authentication/BackButton";
import CardDetail from "./CardDetail"

const VirtualCardDetails = () => {

  return (
    <section className="w-full min-h-full max-w-[360px] mx-auto md:flex justify-center flex-col">
        <div className="flex items-center mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon href="/dashboard/virtual-card"/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Virtual card</p>
        </div>

        <p className="md:hidden mt-14 text-[#344054] text-2xl font-medium text-center">Your virtual card details</p>

        <div className="hidden md:block">
            <BackButton href="/dashboard/virtual-card" className="mb-8" />  
            <h1 className="text-[#112929] font-bold text-[28px]">Virtual card</h1>
            <p className="text-[#667085]  text-sm mt-1">Access a virtual card that works.</p>
        </div>

        <div className="w-full flex flex-col gap-5 bg-white mt-5 md:mt-8 rounded-sm py-6 px-4">
          <CardDetail title="Owner name" value="Anna Keshinro" />
          <CardDetail title="Account number" value="0000000000000000" />
          <CardDetail title="CVV" value="726" />
          <CardDetail title="Expiry" value="09/25" />
          <CardDetail title="Billing address" value="650, Billing rd, New Haven, MI, USA" />
          <CardDetail title="Postal code" value="98986" />
        </div>
    </section>
  )
}

export default VirtualCardDetails;