import CustomButton from "@/components/CustomButton"
import Receipt from "@/components/receipt/Receipt"

const ReceiptLayout = () => {
  return (
    <main className="bg-[#F9FAFB] grid place-items-center min-h-screen py-[60px]">
        <Receipt />
        <CustomButton href="/dashboard" className="w-[90vw] md:max-w-[440px] mt-8 text-center">Return to dashboard</CustomButton>
    </main>
  )
}

export default ReceiptLayout;