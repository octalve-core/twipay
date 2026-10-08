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
      // error: fetchDetailsError,
      } = useQuery<Transaction, Error, Transaction, [string, string]>({
      queryKey: ['transaction-details', id as string],
      queryFn: getTxnHistoryDetail,
      enabled: !!id,
  });

  return (
    <div className="grid place-items-center min-h-full w-full">
        <section className="w-full max-w-[440px] flex flex-col items-center">
            <TxnDetailMobile fetchingDetails={fetchingDetails} txnDetails={txnDetails} />
            <TxnDetailDesktop fetchingDetails={fetchingDetails} txnDetails={txnDetails} />
        </section>
    </div>
  )
}

export default TxnHistoryDetail