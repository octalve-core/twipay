import { Transaction, formatTransactionAmount } from "@/lib/api/dashboard-apis/txnHistoryApis";
import { formatAmount } from "@/lib/utils";
import { FaLongArrowAltDown, FaLongArrowAltUp } from "react-icons/fa";
import { Link } from "react-router-dom";

type TTransactionHistoryCard = {
  transaction: Transaction;
}

const TransactionHistoryCard = ({transaction}: TTransactionHistoryCard) => {
  const txnLogo = transaction?.metadata?.logo;
  const txnProduct = transaction?.metadata?.serviceName
  const serviceCode = transaction?.metadata?.serviceCode
  const txnDirection = transaction?.direction;
  const productName = txnProduct?.includes("-") ? txnProduct.split("-")[0].trim() : txnProduct;

  const accountNumber = transaction?.metadata?.accountNumber;
  const bankName = transaction?.metadata?.bankName;
  const bankTransferRecepient = bankName && accountNumber ? `${accountNumber} / ${bankName}` : null;
  const recipientName = transaction?.metadata?.recipientName;
  const senderUsername = transaction?.metadata?.senderUsername;
  const service = productName || serviceCode || bankTransferRecepient || recipientName || senderUsername || transaction.description;

  const purpose = transaction?.purpose;
  const type = transaction?.type;
  const status = transaction?.status;
  const textColor = status === "success" ? "#008000" : (status === "pending" || status === "processing") ? "#865503" : "#9E0A05";

  return (
    <Link to={`/dashboard/history/${transaction.reference}`} className="flex justify-between items-center hover:opacity-60 transition">
      <div className="flex items-center gap-2.5">
        <div className="size-10 bg-[#E7F6EC] rounded-full grid place-items-center shrink-0">
          {(purpose === "wallet_to_wallet_transfer" || purpose=== "deposit" || type === "wallet_funding" || purpose === "bank_transfer") && <>
              {
                txnDirection === "CREDIT" ? (
                <div className="size-full bg-[#E7F6EC] rounded-full grid place-items-center">
                  <FaLongArrowAltDown className="w-2 h-4 text-[#0F973D]" />
                </div>
              ) : txnDirection === "DEBIT" ? (
                <div className="size-full bg-[#FBEAE9] rounded-full grid place-items-center">
                  <FaLongArrowAltUp className="w-2 h-4 text-[#D42620]" />
                </div>
              ) : null
            }
          </>}
          {txnLogo && <img alt="" className="object-cover rounded-full" src={txnLogo} />}
        </div>

        <div className="flex flex-col">
          <h3 className="text-xs truncate w-50">
            {purpose === "wallet_to_wallet_transfer" && <span className="">{txnDirection === "CREDIT" ? "from" : txnDirection === "DEBIT" ? "to" : null}{" "}</span>}
            <span className="capitalize text-[#000000] font-medium">{service}</span>
          </h3>
          <small className="text-xs text-[#98A2B3] capitalize">{purpose.replaceAll("_", " ")} / <span style={{color: textColor}}>{status}</span></small>
        </div>
      </div>
      <p className="text-sm font-medium shrink-0">
        {status === "success" && <span>{txnDirection === "CREDIT" ? "+" : txnDirection === "DEBIT" ? "-" : null}</span>}
        {transaction ? formatTransactionAmount(transaction) : "—"}
      </p>
    </Link>
  )
}

export default TransactionHistoryCard;