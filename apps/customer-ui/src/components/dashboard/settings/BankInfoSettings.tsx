import { useState } from "react"
import AddNewBank from "./AddNewBank";
import BankInfo from "./BankInfo";

const BankInfoSettings = () => {
    const [showNewAccForm, setShowNewAccForm] = useState(false);

    const showBankInfo = () => setShowNewAccForm(false);
    const showAccForm = () => setShowNewAccForm(true);

  return (
    <div className="min-h-full flex md:items-center justify-center">
        {
            showNewAccForm ? <AddNewBank showBankInfo={showBankInfo} /> : <BankInfo showAccForm={showAccForm} />
        }
    </div>
  )
}

export default BankInfoSettings