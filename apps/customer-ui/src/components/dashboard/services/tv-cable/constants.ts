import ConfirmTvCablePayment from "./ConfirmTvCablePayment";
import RecipientDetails from "./RecipientDetails";
import Status from "./Status";

export const TVCableServiceSteps = [
    {
        id: 1,
        component: RecipientDetails
    },
    {
        id: 2,
        component: ConfirmTvCablePayment
    },
    {
        id: 3,
        component: Status
    },
]