import { columns } from "./columns"
import { UplinesDataTable } from "./uplines-data-table"
import { UplineData } from "@/lib/api/dashboard-apis/referralsApis"

export default function UplineTable({uplineData}: {uplineData: UplineData}) {

  return (
      <UplinesDataTable columns={columns} data={[uplineData]} />
  )
}
