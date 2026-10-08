"use client"

import { UplineData } from "@/lib/api/dashboard-apis/referralsApis";
import { ColumnDef } from "@tanstack/react-table"

const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month}, ${year}`;
  }

export const columns: ColumnDef<UplineData>[] = [
  {
    accessorKey: "refereeId",
    header:() => <div className="text-left text-xs text-[#475467] font-medium px-4">Name</div>,
    cell: ({ row }) => {
        const name = row.original.refereeId.firstname + " " + row.original.refereeId.lastname;
        const userImage = row.original.refereeId?.avatar;
        const username = row.original.refereeId?.username;

        return <div className="flex items-center justify-start gap-3 px-4">
            <div className="grid place-items-center size-10 bg-[#F9F5FF] rounded-full">
                {userImage ? (
                    <img src={userImage} className="object-cover rounded-full" />
                ) : (
                    <span className="uppercase font-bold text-[#112929] text-sm">{name[0]}{name[1]}</span>
                )}
            </div>
            <div className="flex flex-col">
                <h2 className="text-sm font-medium text-[#101828]">{name}</h2>
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
        const status = row.original.refereeId.status;

        const backgroundColor = status === "active" ? "#ECFDF3" : "#FBEAE9";
        const textColor = status === "active" ? "#027A48" : "#9E0A05"

        return <div style={{ backgroundColor, color: textColor}} className="w-fit max-md:ml-auto flex items-center gap-1.5 rounded-2xl py-0.5 px-2 text-xs font-medium capitalize">
            <div className="size-1.5 rounded-full bg-[#12B76A]" />
            <span>{status}</span>
        </div>
    }
  },
  {
    accessorKey: "email",
    header:() => <div className="text-left text-xs text-[#475467] font-medium px-4 max-md:hidden">Email address</div>,
    cell: ({ row }) => {
        const email = row.original.refereeId.email;
        return <div className="text-sm text-[#475467] px-4 max-md:hidden">{email}</div>
    }
  },
  {
    accessorKey: "dateJoined",
    header:() => <div className="text-left text-xs text-[#475467] font-medium px-4 max-md:hidden">Date joined</div>,
    cell: ({ row }) => {
        const dateJoined = row.original.refereeId.createdAt;
        return <div className="text-sm text-[#475467] px-4 max-md:hidden">{formatDate(dateJoined)}</div>
    }
  },
  {
    accessorKey: "dateReffered",
    header:() => <div className="text-left text-xs text-[#475467] font-medium px-4 max-md:hidden">Date referred</div>,
    cell: ({ row }) => {
        const dateReffered = row.original.createdAt;
        return <div className="text-sm text-[#475467] px-4 max-md:hidden">{formatDate(dateReffered)}</div>
    }
  },
]
