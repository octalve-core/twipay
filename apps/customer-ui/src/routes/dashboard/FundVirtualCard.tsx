import { useState } from "react";
import FundCardForm from "@/components/dashboard/virtual-card/FundCardForm";
import EnterFundingPin from "@/components/dashboard/virtual-card/EnterFundingPin";

const FundVirtualCard = () => {
    const [amount, setAmount] = useState("");
    const [showPinForm, setShowPinForm] = useState(false);

  return (
    <div className="w-full min-h-full grid place-items-center">
        {
            showPinForm ? (
                <EnterFundingPin setShowPinForm={setShowPinForm} amount={amount} />
            ) : (
                <FundCardForm amount={amount} setAmount={setAmount} setShowPinForm={setShowPinForm} />
            )
        }
    </div>
  )
}

export default FundVirtualCard