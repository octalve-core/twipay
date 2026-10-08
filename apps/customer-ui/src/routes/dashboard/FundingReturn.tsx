import { Link } from "react-router-dom";
/** Provider redirect is untrusted navigation, never proof of payment or wallet credit. */
export default function FundingReturn() {
  return <main className="w-full min-h-screen grid place-items-center px-5">
    <section className="w-full max-w-[360px] text-center">
      <h1 className="text-[#112929] font-medium text-2xl">Payment submitted</h1>
      <p className="text-[#667085] text-sm mt-4">Returning from a payment provider does not confirm your wallet has been funded. TwiPay verifies payments independently before crediting your balance.</p>
      <Link className="block rounded-[8px] py-3 bg-[#112929] text-white mt-8" to="/dashboard/history">Check transaction history</Link>
    </section>
  </main>;
}
