import BackButton from "@/components/Authentication/BackButton"
import AccountCardItem from "./AccountCardItem"
import { useQuery } from "@tanstack/react-query"
import { getStaticAccount, StaticAccount } from "@/lib/api/dashboard-apis/staticAccountApis"

const StaticAccountDetails = () => {
    const {
        data: staticAcc,
        isLoading: isGenerating,
    } = useQuery<StaticAccount, Error>({
        queryKey: ["get-static-account"],
        queryFn: getStaticAccount,
    })

    (void 0)

    if(isGenerating) {
      return <div className="w-full max-md:self-start">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
          <BackButton icon href="/dashboard"/>
          <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Static acount</p>
        </div>

        <div className="md:hidden mt-14 mb-6 h-4 w-full rounded bg-gray-200 animate-pulse" />

        <div className="max-md:hidden space-y-3 animate-pulse"> 
          <div className="h-4 w-1/2 bg-gray-200 rounded" />
          <div className="h-4 w-3/4 bg-gray-200 rounded" />
        </div>

        <div className="flex flex-col gap-5 bg-white md:mt-8 rounded-sm py-6 px-4 animate-pulse">
          {
            Array.from({length: 3}).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                  <div className="flex flex-col w-full space-y-3">
                      <div className="h-4 w-[50%] bg-gray-200 rounded" />
                      <p className="h-4 w-[80%] bg-gray-200 rounded" />
                  </div>

                  <div className="szie-4 bg-gray-200" />
              </div>
            ))
          }
        </div>
      </div>
    }

  return (
    <section className="w-full max-md:self-start">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
          <BackButton icon href="/dashboard"/>
          <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Static acount</p>
        </div>

        <p className="md:hidden text-xl text-[#344054] font-medium mt-14 mb-6 text-center">Static account has been generated</p>

        <div className="max-md:hidden"> 
          <h1 className="text-2xl text-[#112929] font-medium">Static account</h1>
          <p className="text-[#717171] mt-2">View the details of your static account</p>
        </div>

        <div className="flex flex-col gap-5 bg-white md:mt-8 rounded-sm py-6 px-4">
          <AccountCardItem title="Owner name" value={staticAcc?.account.accountName as string} />
          <AccountCardItem title="Account number" value={staticAcc?.account.accountNumber as string} />
          <AccountCardItem title="Bank name" value={staticAcc?.account.bankName as string} />
        </div>
    </section>
  )
}

export default StaticAccountDetails