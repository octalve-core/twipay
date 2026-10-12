import { useState } from "react";
import { Check, Link } from "lucide-react";

import DownlinesTable from "@/components/dashboard/affiliate/downlines-table/DownlinesTable";
import UplineTable from "@/components/dashboard/affiliate/uplines-table/UplineTable"
import { copyToClipboard } from "@/lib/utils";
import BackButton from "@/components/Authentication/BackButton";
import { getReferrals, getUpline, ReferralResponse, UplineData } from "@/lib/api/dashboard-apis/referralsApis";
import { useQuery } from "@tanstack/react-query";
import EmptyState from "@/components/dashboard/EmptyState";
import Loader from "@/components/Loader";
import { useAuth } from "@/context/AuthContext";

const AffiliatePage = () => {
  const [copied, setCopied] = useState(false);

  const {user} = useAuth()

//   upline data
    const {
        data: uplineData,
        isLoading: fetchingUpline,
    } = useQuery<UplineData, Error>({
        queryKey: ["upline"],
        queryFn: getUpline,
    })

    (void 0)

    // downlines data
    const {
        data,
        isLoading,
    } = useQuery<ReferralResponse, Error>({
        queryKey: ["referrals"],
        queryFn: getReferrals,
    })

  const copyLink = async (text: string) => {
      await copyToClipboard(text);
      setCopied(true);

      setTimeout(() => {
          setCopied(false)
      }, 2000)
  }

  if(isLoading || fetchingUpline) return <Loader className="w-full h-full max-md:hidden" />;

  if(!data) return <EmptyState text="Something went wrong, please refresh" />

  return (
    <div className="w-full max-w-[820px] mx-auto">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon href="/dashboard"/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Affiliate</p>
        </div>
        <h1 className="text-[#112929] text-2xl font-medium text-left mb-8 max-md:hidden">Affiliate</h1>

        {uplineData && <UplineTable uplineData={uplineData} />}

        <div className="flex flex-col gap-1.5 my-5 md:my-8">
            <h2 className="text-[#344054] text-lg">Referral code</h2>
            <div className="flex items-center justify-between bg-white rounded-lg py-2.5 px-3.5 border-[0.5px] border-[#D0D5DD]">
                <p className="text-[#667085] text-sm md:text-xl">{user?.refCode}</p>
                {
                    copied ?
                        ( 
                            <button disabled className="cursor-pointer">
                                <Check className="text-green-500 size-4" />
                            </button>
                        ) 
                            :
                        (
                            <button onClick={() => copyLink(user?.refCode as string)} className="cursor-pointer">
                                <Link className="text-[#344054] size-4 hover:scale-110 transition" />
                            </button>
                        )
                }
            </div>
        </div>

        <DownlinesTable referralData={data?.data} />
    </div>
  )
}

export default AffiliatePage;