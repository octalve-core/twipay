import EnterAmount from "./EnterAmount";
import MakePayment from "./MakePayment";
import SelectPaymentMethod from "./SelectPaymentMethod";

export const AddFundsSteps = [
    {
        step: 1,
        component: EnterAmount
    },
    {
        step: 2,
        component: SelectPaymentMethod
    },
    {
        step: 3,
        component: MakePayment
    },
]