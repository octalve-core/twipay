import TxnDetailDesktop from "@/components/dashboard/history/TxnDetailDesktop";
import TxnDetailMobile from "@/components/dashboard/history/history-mobile/TxnDetailMobile";
import { useQuery } from "@tanstack/react-query";
import { getTxnHistoryDetail, Transaction } from "@/lib/api/dashboard-apis/txnHistoryApis";
import { useParams } from "react-router-dom";

const TxnHistoryDetail = () => {
  const {id} = useParams();

  const {
      data: txnDetails,
      isLoading: fetchingDetails,
      isError,
      error,
      } = useQuery<Transaction, Error, Transaction, [string, string]>({
      queryKey: ['transaction-details', id as string],
      queryFn: getTxnHistoryDetail,
      enabled: !!id,
  });

  return (
    <div className="grid place-items-center min-h-full w-full">
        {isError && <p role="alert" className="text-red-600">{error?.message || "Unable to load transaction details"}</p>}
        <section className="w-full max-w-[440px] flex flex-col items-center">
            {!isError && <TxnDetailMobile fetchingDetails={fetchingDetails} txnDetails={txnDetails} />}
            {!isError && <TxnDetailDesktop fetchingDetails={fetchingDetails} txnDetails={txnDetails} />}
        </section>
    </div>
  )
}

export default TxnHistoryDetail