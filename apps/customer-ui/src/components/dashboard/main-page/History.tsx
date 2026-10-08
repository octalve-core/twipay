import { Link } from "react-router-dom"

import { ChevronRight } from "lucide-react"

import TransactionHistoryCard from "./TransactionHistoryCard"
import { getTxnHistory, TransactionHistoryResponse } from "@/lib/api/dashboard-apis/txnHistoryApis"
import { useQuery } from "@tanstack/react-query"
import EmptyState from "../EmptyState"

const TransactionHistory = () => {
    const {
        data: txnHistoryData,
        isLoading: fetchingHistory,
    } = useQuery<TransactionHistoryResponse, Error>({
        queryKey: ["transaction-history"],
        queryFn: () => getTxnHistory({per_page: 6}),
    })

    (void 0)

  return (
    <section className="mt-7 w-full">
        <div className="flex justify-between items-center">
            <h2 className="text-[#101928] font-medium text-lg">History</h2>
            <Link className="flex items-center gap-1.5 text-[#112929] text-xs" to="/dashboard/history">
                <span className="font-medium">See all</span>
                <ChevronRight className="size-4" />
            </Link>
        </div>
        <div className="mt-2 py-5 px-5 flex flex-col gap-6 rounded-xl bg-white border border-[#F0F2F5]">
          {
            fetchingHistory ? Array.from({length: 6}).map((_, i) => (
              <div key={i} className="flex justify-between items-center animate-pulse">
                <div className="flex items-center gap-2.5">
                  <div className="size-10 bg-[#E7F6EC] rounded-full grid place-items-center">
                    <div className="size-6 bg-gray-200 rounded-full"></div>
                  </div>
                  <div className="flex flex-col">
                    <div className="w-24 h-4 bg-gray-200 rounded"></div>
                    <div className="w-16 h-3 bg-gray-200 rounded mt-1"></div>
                  </div>
                </div>
                <div className="w-16 h-4 bg-gray-200 rounded"></div>
              </div>
            )) : (
              txnHistoryData && txnHistoryData.data.length ? txnHistoryData.data.map((txn) => (
              <TransactionHistoryCard key={txn.id} transaction={txn} />
            )) : <EmptyState className="h-[200px]" text="No transactions yet" />
              )
          }
          
        </div>
    </section>
  )
}

export default TransactionHistory