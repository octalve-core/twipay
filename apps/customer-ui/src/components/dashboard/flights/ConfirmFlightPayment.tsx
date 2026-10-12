import { FormEvent, useState } from "react"
import { Navigate, useParams } from "react-router-dom"

import useFlightStore from "@/stores/useFlightStore"
import EnterPin from "../EnterPin"
import { formatAmount } from "@/lib/utils"
import CustomButton from "@/components/CustomButton"
import BackButton from "@/components/Authentication/BackButton"
import useIsMobile from "@/hooks/useIsMobile"
import Status from "./Status"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { AxiosError } from "axios"
import { bookFlight } from "@/lib/api/dashboard-apis/flightApis"

const ConfirmFlightPayment = () => {
  const [paymenTPin, SetPaymenTPin] = useState<string>("");
  const [showPinForm, setShowPinForm] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  const {selectedAirline, passengerForms, fromLocation,toLocation, update} = useFlightStore();

  const {id} = useParams()
  (void 0)

  const isMobile = useIsMobile();

  const {mutate, isPending} = useMutation({
    mutationFn: bookFlight,
    onSuccess: (data) => {
      (void 0)
      toast.success("Flight booked successfully")
      update({bookedFlightId: data.data.id})
      setShowStatus(true)
    },
    onError: (error: AxiosError) => {
      (void 0)
      update({bookedFlightId: null})
      setShowStatus(true)
        const errData = error.response?.data as { message?: string };
        if(errData.message){
            return toast.error(errData.message)
        }
        toast.error("Something went wrong, please try again")
    }
})

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
  //  Make API call to make withdrawal

    mutate({offer_id: selectedAirline?.id as string, passengers: passengerForms})
  }

  if(showStatus) {
    return <Status />
  }

  if(!selectedAirline) return <Navigate to="/dashboard/book-flight" replace />

  return (
    <div className="min-h-full flex md:items-center justify-center">
      {
        showPinForm ? 
          <section className="flex flex-col max-md:justify-center max-md:text-center">
              <BackButton disabled={isPending} icon={isMobile} action={() => setShowPinForm(false)} className="mb-8" />

              <h1 className="text-[#112929] font-medium text-2xl">Confirm Payment</h1>
              <p className="text-[#717171] mt-2 text-sm md:text-base">Enter your transaction pin to confirm this payment</p>

              <EnterPin disable={isPending} handleSubmit={handleSubmit} value={paymenTPin} onValueChange={SetPaymenTPin} />
          </section> :
          <section className="w-full max-w-[358px] mx-auto flex flex-col max-md:justify-center max-md:text-center">
              <BackButton disabled={isPending} icon={isMobile} href={`/dashboard/flight/passenger-info`} className="mb-8 mr-auto" />
              <h1 className="text-[#112929] font-medium text-2xl">Confirm purchase</h1>
              <p className="text-[#717171] md:mt-2">Confirm the details of this purchase</p>

              <p className="text-[#101828] md:text-xl my-5 md:my-8">You are about to book a {selectedAirline.trip_type.replace("_", " ")} <span className="font-medium">flight ticket</span> from <span className="font-medium">{fromLocation?.full_name}</span> to <span className="font-medium">{toLocation?.full_name}</span> for <span className="font-medium">{formatAmount(parseInt(selectedAirline.price))}</span>.</p>
              <CustomButton disabled={isPending} onClick={() =>setShowPinForm(true)} className="w-full max-w-[360px] mx-auto">Proceed - <span className="opacity-60">Confirm Purchase</span></CustomButton>
          </section>
          }
    </div>
  )
}

export default ConfirmFlightPayment