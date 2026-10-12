import { ReferralData } from "@/lib/api/dashboard-apis/referralsApis"
import { columns } from "./columns"
import { DownlinesDataTable } from "./downlines-data-table"

export default function DownlinesTable({referralData}: {referralData: ReferralData}) {
  return (
      <DownlinesDataTable referralData={referralData} columns={columns} data={referralData[0].referrals} />
  )
}
