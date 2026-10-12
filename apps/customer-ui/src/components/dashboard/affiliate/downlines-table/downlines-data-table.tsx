"use client"

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { ReferralData } from "@/lib/api/dashboard-apis/referralsApis"
import { formatAmount } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
  referralData: ReferralData;
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

export function DownlinesDataTable<TData, TValue>({
  referralData,
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="rounded-xl bg-white border border-[#EAECF0] overflow-hidden w-full">
        <section className="bg-white h-[67px] px-6 flex items-center">
            <h1 className="text-lg text-[#101828] md:text-[#334054] font-medium">Downlines</h1>
            <div className="bg-[#1129290D] rounded-2xl px-2 py-0.5 text-xs text-[#112929] font-medium ml-2">{referralData[0].referrals.length} user{referralData[0].referrals.length > 1 ? "s" : ""}</div>
            <p className="text-[#344054] text-lg ml-auto max-md:hidden">All time earnings <span className="text-xl font-bold text-[#112929]">{formatAmount(referralData[0].totalReferralBonusEarned)}</span></p>
        </section>
        <Table>
            <TableHeader className="bg-[#F9FAFB]">
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow className="border-b border-[#EAECF0]" key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                    return (
                    <TableHead key={header.id}>
                        {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                            )}
                    </TableHead>
                    )
                })}
                </TableRow>
            ))}
            </TableHeader>
            <TableBody className="">
            {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                <TableRow
                    className="h-[72px] border-b border-[#EAECF0]"
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                >
                    {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                    ))}
                </TableRow>
                ))
            ) : (
                <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                    No referrals.
                </TableCell>
                </TableRow>
            )}
            </TableBody>
        </Table>
        {table.getCanNextPage() || table.getCanPreviousPage() && <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#EAECF0]">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 text-[#344054] font-semibold"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ArrowRight className="rotate-180" size={16} />
            <span>Previous</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 text-[#344054] font-semibold"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span>Next</span>
            <ArrowRight size={16} />
          </Button>
      </div>}
    </div>
  )
}
