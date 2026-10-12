import ConfirmMobileMoneyPayment from "./ConfirmMobileMoneyPayment";
import RecipientDetails from "./RecipientDetails";
import Status from "./Status";

export const MobileMoneySteps =[
    {
        id: 1,
        component: RecipientDetails
    },
    {
        id: 2,
        component: ConfirmMobileMoneyPayment
    },
    {
        id: 3,
        component: Status
    },
]