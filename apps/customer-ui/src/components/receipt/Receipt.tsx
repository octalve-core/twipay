import {useSearchParams } from "react-router-dom";
import DesktopReceipt from "./DesktopReceipt"
import MobileReceipt from "./MobileReceipt"
import { getTxnHistoryDetail, Transaction } from "@/lib/api/dashboard-apis/txnHistoryApis";
import { useQuery } from "@tanstack/react-query";


const Receipt = () => {
const [searchParams] = useSearchParams();
const txnId = searchParams.get("txnId");

    const {
        data: txnDetails,
        isLoading: fetchingDetails,
        isError,
        error,
        } = useQuery<Transaction, Error, Transaction, [string, string]>({
        queryKey: ['transaction-details', txnId as string],
        queryFn: getTxnHistoryDetail,
        enabled: !!txnId,
    });

    void 0;

  if (!txnId) return <p role="alert" className="text-red-600">Transaction reference is required to view a transaction record.</p>;
  if (isError) return <p role="alert" className="text-red-600">{error?.message || "Transaction unavailable"}</p>;
  return (
    <>
      {txnDetails && txnDetails.status !== "success" && <p role="status" className="mx-auto max-w-lg mb-4 p-3 text-amber-800 bg-amber-50">Transaction record only — this transaction is {txnDetails.status}. Not proof of successful payment.</p>}
      <DesktopReceipt fetchingDetails={fetchingDetails} txnDetails={txnDetails} />
      <MobileReceipt fetchingDetails={fetchingDetails} txnDetails={txnDetails} />
    </>
  )
}

export default Receipt