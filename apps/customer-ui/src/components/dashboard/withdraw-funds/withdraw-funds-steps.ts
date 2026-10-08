import ConfirmFundsWithdrawal from "./ConfirmFundsWithdrawal";
import EnterAmount from "./EnterAmount";
import RecipientDetails from "./RecipientDetails";
import Status from "./Status";

export const WithdrawFundsSteps = [
    {
        step: 1,
        component: EnterAmount
    },
    {
        step: 2,
        component: RecipientDetails
    },
    {
        step: 3,
        component: ConfirmFundsWithdrawal
    },
    {
        step: 4,
        component: Status
    },
]