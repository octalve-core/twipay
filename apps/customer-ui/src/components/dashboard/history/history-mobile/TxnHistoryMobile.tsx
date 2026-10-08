import { Link } from "react-router-dom";
import { Transaction } from "@/lib/api/dashboard-apis/txnHistoryApis";
import { formatAmount, groupTransactionsByDate } from "@/lib/utils";
import Loader from "@/components/Loader";
import { FaLongArrowAltDown, FaLongArrowAltUp } from "react-icons/fa";
import EmptyState from "../../EmptyState";

type TTxnHistoryMobile = {
  txnHistoryData: Transaction[] | undefined; 
  fetchingHistory: boolean; 
}

const TxnHistoryMobile = ({txnHistoryData, fetchingHistory}: TTxnHistoryMobile) => {
  if(fetchingHistory) {
      return <Loader className="w-full h-[80vh] md:hidden" />
    }
  if(!txnHistoryData || txnHistoryData.length === 0) {
    return <EmptyState className="md:hidden h-[80vh]" text="No transactions" />
  }
  const groupedTransactions = groupTransactionsByDate(txnHistoryData);


  return (
    <div className="md:hidden flex flex-col gap-[15px] mt-14">
      {
        groupedTransactions.map((group) => (
          <section key={group.dateGroup}>
            <p className="text-[#344054] text-sm">{group.dateGroup}</p>
            <div className="flex flex-col gap-[22px] mt-3">
              {
                group.transactions.map((txn) => {
                  const txnProduct = txn.metadata?.productName || txn.metadata?.serviceName;
                  const productName = txnProduct?.includes("-") ? txnProduct.split("-")[0].trim() : txnProduct;

                  const accountNumber = txn?.metadata?.accountNumber;
                  const bankName = txn?.metadata?.bankName;
                  const bankTransferRecepient = bankName && accountNumber ? `${accountNumber} / ${bankName}` : null;
                  const recipientEmail = txn?.metadata?.recipientName;
                  const senderUsername = txn?.metadata?.senderUsername;

                  const txnDirection = txn.direction;
                  const purpose = txn.purpose;
                  const type = txn.type;
                  const txnLogo = txn.metadata?.logo;
                  const time = new Date(txn.createdAt).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  }).replace(" ", "");
                    const status = txn.status;
                    const textColor = status === "success" ? "#008000" : (status === "pending" || status === "processing") ? "#865503" : "#9E0A05";

                  return (
                    <Link to={`/dashboard/history/${txn.reference}`} key={txn.id} className="flex items-center gap-[13px] py-[9.5px]">
                        <div className="grid place-items-center size-[50px] rounded-full shrink-0 bg-[#E7F6EC]">
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
                          {txnLogo && <img src={txnLogo} className="size-full rounded-full object-cover" />}
                        </div>
                        <div className="">
                          <h3 className=" truncate w-40">
                            {(purpose === "wallet_to_wallet_transfer" || purpose=== "deposit" || purpose === "bank_transfer") && <span className="text-xs">{txnDirection === "CREDIT" ? "from" : txnDirection === "DEBIT" ? "to" : null}{" "}</span>}
                            {(purpose === "wallet_to_wallet_transfer" || purpose=== "deposit" || purpose === "bank_transfer") 
                              ? <span className="text-[#344054] font-medium">{recipientEmail || senderUsername || bankTransferRecepient}</span> 
                              : <span className="capitalize text-[#344054] font-medium">{purpose ? purpose?.replaceAll("_", " ") : productName}</span>}
                            
                          </h3>
                          <p className="text-[#344054] text-sm">{time} / <span style={{color: textColor}}>{status}</span></p>
                        </div>
                        <p className="text-[#344054] font-medium ml-auto shrink-0">{status === "success" && <span>{txnDirection === "CREDIT" ? "+" : txnDirection === "DEBIT" ? "-" : null}</span>} {txn?.metadata?.country?.currencySymbol ? `${txn.metadata.country.currencySymbol}${txn.amount} ` : formatAmount(txn?.amount as number)}</p>
                    </Link>
                )})
              }
            </div>
          </section>
        ))
      }
    </div>
  )
}

export default TxnHistoryMobile