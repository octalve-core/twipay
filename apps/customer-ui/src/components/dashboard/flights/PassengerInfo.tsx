import { Passenger } from "@/lib/api/dashboard-apis/flightApis";
import PassengerInfoForm from "./PassengerInfoForm";
import { PassengerFormData } from "@/stores/useFlightStore";
import DocumentInfo from "./DocumentInfo";

type TPassengerInfo = {
    showDocumentForm: boolean;
    setShowDocumentForm: React.Dispatch<React.SetStateAction<boolean>>;

    passenger: Passenger;
    index: number;
    onNext: (passengerFormData: PassengerFormData) => void;
}

const PassengerInfo = ({showDocumentForm, setShowDocumentForm, passenger, index, onNext}: TPassengerInfo) => {
  return (
    showDocumentForm ? (
        <DocumentInfo 
            setShowDocumentForm={setShowDocumentForm} 
        />
    ) : (
        <PassengerInfoForm
            key={index}
            index={index} 
            passenger={passenger} 
            onNext={onNext} 
            setShowDocumentForm={setShowDocumentForm} 
        />
    )
  )
}

export default PassengerInfo