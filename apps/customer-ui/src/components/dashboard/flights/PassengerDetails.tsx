import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import useFlightStore, { PassengerFormData } from "@/stores/useFlightStore";
import PassengerInfo from "./PassengerInfo";

const PassengerDetails = () => {
    const [showDocumentForm, setShowDocumentForm] = useState(false);

    const navigate = useNavigate();

    const {selectedAirline, currentStep, updatePassenger, setCurrentStep} = useFlightStore();
    const passengers = selectedAirline?.passengers || [];

    (void 0)

    const handleNext = (passengerFormData: PassengerFormData) => {
      updatePassenger(currentStep, passengerFormData);
      if(currentStep < passengers.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        navigate(`/dashboard/flight/${selectedAirline?.id}/confirm`)
      }
    }

    if(!selectedAirline) return <Navigate to="/dashboard/book-flight" replace />

  return (
    <div className="min-h-full flex md:items-center justify-center">
        <section className="w-full mx-auto">
            <PassengerInfo
              key={currentStep}
              passenger={passengers[currentStep]}
              index={currentStep}
              onNext={handleNext}
              showDocumentForm={showDocumentForm} 
              setShowDocumentForm={setShowDocumentForm}
            />
        </section>
    </div>
  )
}

export default PassengerDetails;