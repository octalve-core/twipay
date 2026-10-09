import CustomButton from '@/components/CustomButton';
/** ErhaPay in-app email transfer has no equivalent authenticated TwiPay API contract. */
const TransferFunds = () => <section className="w-full min-h-full grid place-items-center">
  <div className="max-w-[360px] w-full text-center">
    <h1 className="text-[#112929] font-medium text-2xl">Transfer funds</h1>
    <p className="mt-3 text-[#717171]">Transfers to other TwiPay users aren't available right now. You can review your existing transactions in the meantime.</p>
    <CustomButton className="w-full mt-7" href="/dashboard/withdraw-funds">Bank withdrawal options</CustomButton>
  </div>
</section>;
export default TransferFunds;
