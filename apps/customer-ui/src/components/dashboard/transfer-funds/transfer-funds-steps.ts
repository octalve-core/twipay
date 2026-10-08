import ConfirmFundsTransfer from "./ConfirmFundsTransfer";
import EnterRecipientDetails from "./EnterRecipientDetails";
import Status from "./Status";

export const TransferFundsSteps = [
    {
        step: 1,
        component: EnterRecipientDetails
    },
    {
        step: 2,
        component: ConfirmFundsTransfer
    },
    {
        step: 3,
        component: Status
    },
]