"use client"

import { Referral } from "@/lib/api/dashboard-apis/referralsApis";
import { formatAmount } from "@/lib/utils";
import { ColumnDef } from "@tanstack/react-table"

const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month}, ${year}`;
  }

export const columns: ColumnDef<Referral>[] = [
  {
    accessorKey: "referredId",
    header:() => <div className="text-left text-xs text-[#475467] font-medium px-4">Name</div>,
    cell: ({ row }) => {
        const firstname = row.original.referredId.firstname;
        const lastname = row.original.referredId.lastname;
        const name = `${firstname} ${lastname}`;
        const userImage = row.original.referredId?.avatar;
        const username = row.original.referredId?.username;

        return <div className="flex items-center justify-start gap-3 px-4">
            <div className="grid place-items-center size-10 bg-[#F9F5FF] rounded-full">
                {userImage ? (
                    <img alt="" src={userImage} className="object-cover rounded-full" />
                ) : (
                    <span className="uppercase font-bold text-[#112929] text-sm">{firstname[0]}{lastname[0]}</span>
                )}
            </div>
            <div className="flex flex-col">
                <h2 className="text-sm font-medium text-[#101828] capitalize">{name}</h2>
                {username && <span className="text-[#475467] text-sm">
                    @{username}
                </span>}
            </div>
        </div>
    }
  },
  {
    accessorKey: "status",
    header:() => <div className="text-center md:text-left text-xs text-[#475467] font-medium">Status</div>,
    cell: ({ row}) => {
        const isActive = !row.original.referredId.email.split("] ")[1]
        const status = isActive ? "Active" : "Inactive"

        const backgroundColor = isActive  ? "#ECFDF3" : "#FBEAE9";
        const textColor = isActive  ? "#027A48" : "#9E0A05"

        return <div style={{ backgroundColor, color: textColor}} className="max-md:ml-auto w-fit flex items-center gap-1.5 rounded-2xl py-0.5 px-2 text-xs font-medium capitalize">
            <div style={{backgroundColor: textColor}} className="size-1.5 rounded-full" />
            <span>{status}</span>
        </div>
    }
  },
  {
    accessorKey: "email",
    header:() => <div className="text-left text-xs text-[#475467] font-medium px-4 max-md:hidden">Email address</div>,
    cell: ({ row }) => {
        const email = row.original.referredId.email;
        return <div className="text-sm text-[#475467] px-4 max-md:hidden">{email.split("] ")[1] ? email.split("] ")[1] : email}</div>
    }
  },
  {
    accessorKey: "dateJoined",
    header:() => <div className="text-left text-xs text-[#475467] font-medium px-4 max-md:hidden">Date joined</div>,
    cell: ({ row }) => {
        const dateJoined = row.original.referredId.createdAt;
        return <div className="text-sm text-[#475467] px-4 max-md:hidden">{formatDate(dateJoined)}</div>
    }
  },
  {
    accessorKey: "amountEarned",
    header:() => <div className="text-left text-xs text-[#475467] font-medium px-4 max-md:hidden">Amount earned</div>,
    cell: ({ row }) => {
        const amountEarned = row.original.totalAmount;
        return <div className="text-sm text-[#475467] px-4 max-md:hidden">{formatAmount(amountEarned)}</div>
    }
  },
]
