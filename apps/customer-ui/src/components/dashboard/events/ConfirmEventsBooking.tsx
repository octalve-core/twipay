import { FormEvent, useState } from "react"

import EnterPin from "../EnterPin"
import CustomButton from "@/components/CustomButton"
import useEventsStore from "@/stores/useEventsStore"
import BackButton from "@/components/Authentication/BackButton"
import useIsMobile from "@/hooks/useIsMobile"

const ConfirmEventsBooking = () => {
  const [paymenTPin, SetPaymenTPin] = useState<string>("");
  const [showPinForm, setShowPinForm] = useState(false);

  const isMobile =useIsMobile()

  const { data, update } = useEventsStore();

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
    //  Make API call to make book event
        (void 0)

    // if successful
        update({step: 4, isSuccessful: true});
    }

  return (
    <div className="min-h-full max-md:text-center flex md:items-center justify-center">
      {
        showPinForm ? 
          <section className="flex flex-col max-md:justify-center">
                <BackButton icon={isMobile} action={() => setShowPinForm(false)} className="mb-8" />

                <h1 className="text-[#112929] font-medium text-2xl">Confirm Payment</h1>
                <p className="text-[#717171] mt-2 text-sm md:text-base">Enter your transaction pin to confirm this payment</p>

                <EnterPin handleSubmit={handleSubmit} value={paymenTPin} onValueChange={SetPaymenTPin} />
          </section> :
          <section className="w-full max-w-[358px] mx-auto flex flex-col max-md:justify-center">
            <BackButton icon={isMobile} action={() => update({step: 2})} className="mb-8" />
            <h1 className="text-[#112929] font-medium text-2xl">Confirm purchase</h1>
            <p className="text-[#717171] md:mt-2">Confirm the details of this purchase</p>

            <p className="text-[#101828] text-xl font-medium my-5 md:my-8">You are about to purchase event ticket to 5ive listening party for ₦ 1,000.</p>
            <CustomButton onClick={() =>setShowPinForm(true)} className="w-full">Proceed - <span className="opacity-60">Confirm Purchase</span></CustomButton>
          </section>
          }
    </div>
  )
}

export default ConfirmEventsBooking