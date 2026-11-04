import RecipientDetailForm from "./RecipientDetailForm"
import useWithdrawFundsStore from "@/stores/useWithdrawFunds";
import BackButton from "@/components/Authentication/BackButton";

const RecipientDetails = () => {
    const {update} = useWithdrawFundsStore();

  return (
    <section className="w-full max-w-[360px] mx-auto">
        <div className="flex items-center fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5 mt-2 md:hidden">
            <BackButton icon action={() => update({step: 1})}/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Withdraw funds</p>
        </div>

        <div className="max-md:hidden">
          <BackButton className="mb-8" action={() => update({step: 1})} />
          <h1 className="text-[#112929] font-medium text-2xl">Withdraw funds</h1>
          <p className="text-[#717171] mt-2">Enter the details below to withdraw funds</p>
        </div>

        <RecipientDetailForm />
    </section>
  )
}

export default RecipientDetails