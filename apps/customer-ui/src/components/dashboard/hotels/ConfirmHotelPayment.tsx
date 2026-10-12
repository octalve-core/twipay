import { FormEvent, useState } from "react"
import { useParams } from "react-router-dom"
import EnterPin from "../EnterPin"
import { formatAmount } from "@/lib/utils"
import CustomButton from "@/components/CustomButton"
import useHotelsStore from "@/stores/useHotelsStore"
import BackButton from "@/components/Authentication/BackButton"
import useIsMobile from "@/hooks/useIsMobile"
import Status from "./Status"

const ConfirmHotelPayment = () => {
  const [paymenTPin, SetPaymenTPin] = useState<string>("");
  const [showPinForm, setShowPinForm] = useState(false);

  const { customerInfo, dob, checkin, checkout, update, isSuccessful } = useHotelsStore();

  const getNumberOfNights = () => {
    if (!checkin || !checkout) return '';

    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const diffInMilliseconds = checkout.getTime() - checkin.getTime();
    const nights = Math.floor(diffInMilliseconds / millisecondsPerDay);
    
    return  nights > 0 ? `${nights} night${nights > 1 ? 's' : ''}` : '';
  };
  const noOfNights = getNumberOfNights();
  const isMobile = useIsMobile();

  const {id} = useParams()
  (void 0)

    const handleSubmit = (e: FormEvent) => {
      e.preventDefault();
    //  Make API call to make withdrawal
      (void 0)

      update({ isSuccessful: true})
    }

    if(isSuccessful) {
      return <Status />
    }

  return (
    <div className="min-h-full flex md:items-center justify-center">
      {
        showPinForm ? 
        <section className="flex flex-col max-md:justify-center max-md:text-center">
            <BackButton icon={isMobile} action={() => setShowPinForm(false)} className="mb-8" />

            <h1 className="text-[#112929] font-medium text-2xl">Confirm Payment</h1>
            <p className="text-[#717171] mt-2 text-sm md:text-base">Enter your transaction pin to confirm this payment</p>

            <EnterPin handleSubmit={handleSubmit} value={paymenTPin} onValueChange={SetPaymenTPin} />
        </section> :
        <section className="w-full max-w-[358px] mx-auto flex flex-col max-md:justify-center max-md:text-center">
            <BackButton icon={isMobile} href={`/dashboard/hotels/${id}/customer-info`} className="mb-8 mr-auto" />
            <h1 className="text-[#112929] font-medium text-2xl">Confirm purchase</h1>
            <p className="text-[#717171] md:mt-2">Confirm the details of this purchase</p>

            <p className="text-[#101828] md:text-xl my-5 md:my-8">You are about to book <span className="font-medium">xxx hotel</span> for <span className="font-medium">one night</span>  for <span className="font-medium">{formatAmount(parseInt("10000"))}</span>.</p>
            <CustomButton onClick={() =>setShowPinForm(true)} className="w-full max-w-[360px] mx-auto">Proceed - <span className="opacity-60">Confirm Purchase</span></CustomButton>
        </section>
          }
    </div>
  )
}

export default ConfirmHotelPayment