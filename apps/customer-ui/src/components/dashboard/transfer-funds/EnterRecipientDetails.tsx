import TransferFundsForm from "./TransferFundsForm"
import BackButton from "@/components/Authentication/BackButton";

const EnterRecipientDetails = () => {
  return (
    <section className="w-full max-w-[360px] mx-auto max-md:self-start">
      <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
          <BackButton icon href="/dashboard"/>
          <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Transfer funds</p>
      </div>

      <div className="max-md:hidden">
        <BackButton className="mb-8" href="/dashboard" />
        <h1 className="text-[#112929] font-medium text-2xl">Transfer funds</h1>
        <p className="text-[#717171] mt-2">Enter the details below to transfer funds</p>
      </div>

        <TransferFundsForm />
    </section>
  )
}

export default EnterRecipientDetails