// Existing ErhaPay visual structure retained; card issuance has no TwiPay API yet.
const CreditCard = () => (
  <div className="w-full h-[110px] md:h-[152px] grid grid-cols-4 rounded-lg overflow-hidden text-white" aria-label="Virtual card services unavailable">
    <div className="col-span-3 bg-[#344054] p-3 md:p-4 flex flex-col justify-between">
      <h3 className="text-base md:text-xl font-bold">Virtual cards</h3>
      <p className="text-xs md:text-sm text-gray-200">Coming later — not available for transactions</p>
    </div>
    <div className="col-span-1 bg-gradient-to-b from-purple-400 to-red-300" aria-hidden="true" />
  </div>
);
export default CreditCard;
