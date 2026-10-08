import { formatDateTime } from "@/lib/utils";
import { ColumnDef } from "@tanstack/react-table"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu"

  import { BiDotsVerticalRounded } from "react-icons/bi";
  // import { Checkbox } from "@/components/ui/checkbox";
import CustomButton from "@/components/CustomButton";
import { Transaction, formatTransactionAmount } from "@/lib/api/dashboard-apis/txnHistoryApis";
import { PiArrowBendLeftUpBold, PiArrowBendRightDownBold, PiArrowsDownUpBold } from "react-icons/pi";

export const columns: ColumnDef<Transaction>[] = [
    {
        id: "select",
        // header: ({ table }) => (
        //   <Checkbox
        //     checked={
        //       table.getIsAllPageRowsSelected() ||
        //       (table.getIsSomePageRowsSelected() && "indeterminate")
        //     }
        //     onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        //     aria-label="Select all"
        //     className="border-[#D0D5DD]"
        //   />
        // ),
        // cell: ({ row }) => (
        //   <Checkbox
        //     checked={row.getIsSelected()}
        //     onCheckedChange={(value) => row.toggleSelected(!!value)}
        //     aria-label="Select row"
        //     className="border-[#D0D5DD]"
        //   />
        // ),
        // enableSorting: false,
        // enableHiding: false,
    },    
  {
    accessorKey: "id",
    header: () => <div className="text-[#344054] text-left font-medium text-xs capitalize">S/N</div>,
    cell: ({ row }) => {
      const serialNumber = row.index + 1;

        return <div className="text-sm text-[#334054] font-bold">
           {serialNumber}.
        </div>
    }
  },
  {
    accessorKey: "meta",
    header: () => <div className="text-[#344054] text-left font-medium text-xs capitalize">Recipient</div>,
    cell: ({ row }) => {
        const meta = row.original.metadata || {};
        const accountNumber = meta?.accountNumber;
        const bankName = meta?.bankName;
        const bankTransferRecepient = bankName && accountNumber ? `${accountNumber} / ${bankName}` : null;
        const recipientEmail = meta?.recipientName;
        const senderUsername = meta?.senderUsername;
        const {customerId, meterNumber, profileId, smartCardNumber, phone} = meta;
        const recipient = smartCardNumber || profileId || meterNumber || customerId || phone  || recipientEmail || bankTransferRecepient || senderUsername || null;
        // const txnProduct = row.original.meta.product?.name || row.original.meta.provider?.name || "";
        // const productName = txnProduct.includes("-") ? txnProduct.split("-")[0].trim() : txnProduct;
        const purpose = row.original.purpose;
        const type = row.original.type;
        const txnLogo = row.original.metadata?.logo

        const Icon = purpose === "wallet_to_wallet_transfer" ? PiArrowsDownUpBold : (purpose === "deposit" || type === "wallet_funding") ? PiArrowBendRightDownBold : purpose === "bank_transfer" ? PiArrowBendLeftUpBold : null;

        return <div className="flex items-center justify-start gap-3">
            <div className="grid place-items-center size-10 bg-[#1129290D] rounded-full">
                <span className="uppercase font-bold text-[#667085] text-sm">
                  {Icon && <Icon className="size-3.5" />}
                  {txnLogo && <img src={txnLogo} alt="Transaction Product Logo" className="size-full object-cover rounded-full" />}
                </span>
            </div>
            <div className="flex flex-col">
                <h2 className="text-sm font-medium line-clamp-1 capitalize text-ellipsis w-40">{purpose.replaceAll("_", " ")}</h2>
                <span className="text-[#475367] text-sm">
                  <small className="">{recipient ? `${recipient}` : null}</small>
                </span>
            </div>
        </div>
    }
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-[#344054] text-left font-medium text-xs capitalize">Amount</div>,
    cell: ({row}) => {
        const formattedAmount = formatTransactionAmount(row.original);

        return <div className="text-sm text-[#344054]">{formattedAmount}</div>
    }
  },
  {
    accessorKey: "type",
    header: () => <div className="text-[#344054] text-left font-medium text-xs capitalize">Transaction Type</div>,
    cell: ({ row }) => {
        const txnDirection = row.original.direction;
        const backgroundColor = txnDirection === "CREDIT" ? "#ECFFED" : "#E3EFFC";
        const textColor = txnDirection === "CREDIT" ? "#046B21" : "#04326B"

        return <div 
                style={{backgroundColor, color: textColor }} 
                className="capitalize py-0.5 px-3 rounded-sm text-sm w-fit"
            >
                {txnDirection}
            </div>
    }
  },
  {
    accessorKey: "created_at",
    header: () => <div className="text-[#344054] text-left font-medium text-xs capitalize">Date</div>,
    cell: ({row}) => {
        const date = formatDateTime(row.original.createdAt);

        return <div className="text-sm text-[#344054]">{date}</div>
    }
  },
  {
    accessorKey: "status",
    header: () => <div className="text-[#344054] text-left font-medium text-xs capitalize">Status</div>,
    cell: ({row}) => {
        const status = row.original.status;
        const backgroundColor = status === "success" ? "#00800008" : status === "pending" ? "#FEF6E7" : "#FBEAE9";
        const textColor = status === "success" ? "#008000" : status === "pending" ? "#865503" : "#9E0A05";

        return <div 
                style={{backgroundColor, color: textColor }} 
                className="capitalize py-0.5 px-3 rounded-sm text-sm w-fit"
            >
                {status}
            </div>
    }
  },
]
