import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Transaction, formatTransactionAmount } from "@/lib/api/dashboard-apis/txnHistoryApis"
import TxnHistoryTablePagination from "@/routes/dashboard/TxnHistoryTablePagination"
import EmptyState from "../EmptyState"
import { LuDownload } from "react-icons/lu"
import CustomButton from "@/components/CustomButton"

import BackButton from "@/components/Authentication/BackButton";
import Filterbutton from "./Filterbutton"
import { formatDateTime } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalPages: number;
  selectRows: (selectedRows: Transaction[]) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  totalPages,
  selectRows,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = useState({});

  const navigate = useNavigate();
  
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  })

const exportToCsv = (rows: TData[], fileName: string) => {
  if (!rows || !rows.length) {
    (void 0);
    return;
  }

  // Define the columns you want to export
  const csvHeaders = [
    "S/N",
    "Recipient",
    "Transaction Type",
    "Amount",
    "Purpose",
    "Date",
    "Status",
  ];

  const csvRows = rows.map((row, index) => {
    const txn = row as Transaction;

    // Flatten nested meta data

    const direction = txn.direction;
    const customer = txn.metadata || {};
    // const username = txn.meta.username;
    // const firstname = txn.meta.firstname;
    // const lastname = txn.meta.lastname;
    // const customerEmail = txn.meta.customer_email;
    const { meterNumber, phone, serviceName, smartCardNumber, customerId, productName, profileId, recipientName, accountNumber } = customer;
    // const safeCustomerId = customer_id ? `'${customer_id}'` : "";
    // const safePhone = phone ? `'${phone}'` : "";
    // const safeSmartcardNumber = smartcard_number ? `'${smartcard_number}'` : "";
    // const safeRegistrationNumber = registration_number ? `'${registration_number}'` : "";

    const recipient =
      meterNumber ||
      phone ||
      customerId ||
      profileId ||
      smartCardNumber ||
      recipientName ||
      accountNumber

    const prdName =
      serviceName ||
      productName ||
      "";

    const formattedAmount = formatTransactionAmount(txn);
    const formattedDate = formatDateTime(txn.createdAt);

    return [
      index + 1,
      recipient || prdName || "-",
      direction,
      formattedAmount,
      txn.type,
      formattedDate,
      txn.status,
    ];
  });

  const csvContent =
    "data:text/csv;charset=utf-8,\uFEFF" +
    csvHeaders.join(",") +
    "\n" +
    csvRows.map((row) => row.map((v) => {
      const safe = String(v ?? "");
      const escaped = /^[\s\u0000-\u001f]*[=+@-]/.test(safe) ? `'${safe}` : safe;
      return `"${escaped.replaceAll('"', '""')}"`;
    }).join(",")).join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


  useEffect(() => {
      const selectedFields = Object.values(table.getSelectedRowModel().rowsById).map(item => item.original) as Transaction[]
      selectRows(selectedFields)
  }, [rowSelection, table])

  return (
    <div className="w-full max-md:hidden">
      <div className="flex flex-col gap-2 md:flex-row md:items-center justify-between mb-8">
        <div className="max-md:hidden flex items-center gap-4">
          <BackButton icon href="/dashboard"/>
          <h1 className="text-[#101928] font-medium text-2xl">History</h1>
        </div>
        
        <div className="flex items-center max-md:justify-end gap-4 max-md:hidden">
          {/* {
            selectedFields.length ? (
              <CustomButton className="flex items-center gap-2.5 text-sm bg-red-500">
                <Trash className="size-5" />
                <span>Delete</span>
              </CustomButton>
            ) : null
          } */}
          <Filterbutton />
          <CustomButton disabled={!data.length} onClick={() => exportToCsv(data, "transactions.csv")} className="flex items-center gap-2.5 text-sm py-2 px-3 rounded-sm">
          {/* <CustomButton disabled={!data.length} className="flex items-center gap-2.5 text-sm py-2 px-3 rounded-sm"> */}
            <LuDownload className="size-5" />
            <span className="font-medium">Export CSV</span>
          </CustomButton>
        </div>
      </div>
      {/* Transaction history table */}
      <div>
        <Table className="rounded-md overflow-hidden">
          <TableHeader className="bg-[#F0F2F5]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow className="border-[#D0D5DD] h-[44px]" key={headerGroup.id}>
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
          <TableBody className="bg-white">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  className="border-none h-[82px] hover:bg-gray-100 transition cursor-pointer"
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => {
                    const id = (row.original as Transaction).reference
                    navigate(`/dashboard/history/${id}`)
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell className="p-0" key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <EmptyState className="h-[300px]" text="No transactions." />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {/* Pagination */}
      {totalPages > 1 && <div className=" bg-white border-t border-[#E4E7EC]">
          <TxnHistoryTablePagination totalPages={totalPages} />
      </div>}
    </div>
  )
}
