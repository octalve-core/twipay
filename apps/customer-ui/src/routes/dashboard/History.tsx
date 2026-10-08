import { useState } from "react";

import { columns } from "@/components/dashboard/history/columns"
import {DataTable} from "@/components/dashboard/history/data-table"

import TxnHistoryMobile from "@/components/dashboard/history/history-mobile/TxnHistoryMobile";
import { useQuery } from "@tanstack/react-query";
import { getTxnHistory, ITEMS_PER_PAGE, Transaction, TransactionHistoryResponse } from "@/lib/api/dashboard-apis/txnHistoryApis";
import Loader from "@/components/Loader";
import { useSearchParams } from "react-router-dom";
import useIsMobile from "@/hooks/useIsMobile";
import BackButton from "@/components/Authentication/BackButton";
import Filterbutton from "@/components/dashboard/history/Filterbutton";
import TxnHistoryTablePagination from "./TxnHistoryTablePagination";

const History = () => {
    // const [txnHistory, setTxnHistory] = useState<Transaction[]>([]);
    // const [filteredTxnHistory, setFilteredTxnHistory] = useState();
    const [selectedFields, setSelectedFields] = useState<Transaction[]>([]);
    const selectRows = (selectedRows: Transaction[]) => setSelectedFields(selectedRows);

    const [searchParams] = useSearchParams();
    const isMobile = useIsMobile();

    const page = parseInt(searchParams.get("page") || "1");
    const per_page = isMobile ? 100 : ITEMS_PER_PAGE;
    const status = searchParams.get("status") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const startPrice = searchParams.get("startPrice") || "";
    const endPrice = searchParams.get("endPrice") || "";
    const type = searchParams.get("type") || "";

    const {
        data: txnHistory,
        isLoading: fetchingHistory,
        isError: hasHistoryError,
        error: historyError,
    } = useQuery<TransactionHistoryResponse, Error>({
        queryKey: ["transaction-history", page, per_page, status, startDate, endDate,  startPrice, endPrice, type],
        queryFn: () => getTxnHistory({page, per_page, status, startDate, endDate,  startPrice, endPrice, type}),
    })

    const totalPages = txnHistory?.pagination.totalPages ?? 0;

    (void 0)

  return (
    <div>    
      <div className="flex items-center justify-between mb-7 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
          <BackButton icon href="/dashboard"/>
          <p className="text-[#667085] font-medium text-xl w-full text-center">History</p>
          <Filterbutton />
      </div>
      {hasHistoryError && <p role="alert" className="mb-4 text-red-600">Unable to load transaction history: {historyError?.message}</p>}
      {!hasHistoryError && (txnHistory && !fetchingHistory) ? <DataTable totalPages={totalPages} selectRows={selectRows} columns={columns} data={txnHistory.data} /> : <Loader className="max-md:hidden w-full h-full" />}
      {!hasHistoryError && <TxnHistoryMobile fetchingHistory={fetchingHistory} txnHistoryData={txnHistory?.data} />}
      {!hasHistoryError && totalPages > 1 && <div className="md:hidden"><TxnHistoryTablePagination totalPages={totalPages} /></div>}
    </div>
  )
}

export default History