import VirtualCardWithdrawFundsForm from "@/components/dashboard/virtual-card/VirtualCardWithdrawFundsForm";
import EnterWithdrawalPin from "@/components/dashboard/virtual-card/EnterWithdrawalPin";
import useVirtualCardWithdraw from "@/stores/useVirtualCardWithdraw";

const VirtualCardWithdraw = () => {
    const {showPinForm} = useVirtualCardWithdraw();

  return (
    <div className="w-full min-h-full grid place-items-center">
        {
            showPinForm ? (
                <EnterWithdrawalPin />
            ) : (
                <VirtualCardWithdrawFundsForm />
            )
        }
    </div>
  )
}

export default VirtualCardWithdraw