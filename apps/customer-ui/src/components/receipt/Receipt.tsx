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
        // error: fetchDetailsError,
        } = useQuery<Transaction, Error, Transaction, [string, string]>({
        queryKey: ['transaction-details', txnId as string],
        queryFn: getTxnHistoryDetail,
        enabled: !!txnId,
    });

    (void 0)

  return (
    <>
      <DesktopReceipt fetchingDetails={fetchingDetails} txnDetails={txnDetails} />
      <MobileReceipt fetchingDetails={fetchingDetails} txnDetails={txnDetails} />
    </>
  )
}

export default Receipt