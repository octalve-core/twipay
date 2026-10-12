import BackButton from "@/components/Authentication/BackButton"
import CustomButton from "@/components/CustomButton"
import useIsMobile from "@/hooks/useIsMobile"
import { getSavedAccounts } from "@/lib/api/dashboard-apis/settingsApis";
import { useQuery } from "@tanstack/react-query";

export type TSavedBankAccount = {
  _id: string;
  __v: string;
  userId: string;
  bankCode: string;
  bank_id: string;
  accountNumber: string;
  accountName: string;
  createdAt: string;
  updatedAt: string;
  bankName: string;
};

const BankInfo = ({showAccForm}: {showAccForm: () =>void}) => {
    const isMobile = useIsMobile();

    const {
        data: accounts,
        isLoading,
        error
    } = useQuery<TSavedBankAccount[], Error>({
        queryKey: ["bank-accounts"],
        queryFn: getSavedAccounts,
    })

  return (
    <section className="w-full max-w-[360px] mx-auto">
        <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
            <BackButton icon href="/dashboard/settings"/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Saved bank info</p>
        </div>

        <div className="hidden md:block">
            <BackButton href="/dashboard/settings" className="mb-5" />  
            <h1 className="text-[#112929] font-bold text-[28px]">Bank info</h1>
            <p className="text-[#727884]  text-sm mt-1">View your saved bank infos.</p>
        </div>

        <div className="mt-14 md:mt-12 flex flex-col gap-4">
            {
                isLoading && Array.from({length: 3}).map((_, id) => (
                    <div className="flex items-center gap-3 rounded-[10px] bg-[#F5F5F5] md:bg-white py-2 px-4" key={id}>
                        <div className="size-[51px] rounded-full bg-gray-200 animate-pulse"/>

                        <div className="flex flex-col gap-2">
                            <p className="animate-pulse w-40 h-4 bg-gray-200"></p>
                            <div className="flex items-center gap-1.5">
                                <p className="animate-pulse w-full h-4 bg-gray-200"></p>
                                <div className="h-[13px] w-[0.6px] bg-[#BBBBBB]" />
                                <p className="animate-pulse w-full h-4 bg-gray-200"></p>
                            </div>
                        </div>
                    </div>
                ))
            }
            {
                error && <p className="text-red-600 text-sm">Error while loading your saved banks, please refresh.</p>
            }
            {
                (accounts && accounts.length) ? accounts.map((account) => {
                    return (
                        <div className="flex items-center gap-3 rounded-[10px] bg-[#F5F5F5] md:bg-white py-2 px-4" key={account._id}>
                            <div className="size-[51px] rounded-full grid place-items-center bg-[#112929] text-white text-lg font-extrabold">
                                <span>{`${account.accountName.split("")[0]} ${account.accountName.split("")[1]}`}</span>
                            </div>

                            <div className="">
                                <p className="text-sm text-[#344054] font-medium">{account.accountName}</p>
                                <div className="flex items-center gap-1.5 text-sm font-medium text-[#344054AB]">
                                    <span>{account.bankName}</span>
                                    <div className="h-[13px] w-[0.6px] bg-[#BBBBBB]" />
                                    <span>{account.accountNumber}</span>
                                </div>
                            </div>
                        </div>
                )}) : null
            }
            {!isLoading && !accounts?.length && <div>No saved accounts.</div>}
        </div>

        <CustomButton disabled={isLoading} variant={isMobile ? "primary" : "secondary"} onClick={showAccForm} className="w-full mt-10 md:mt-12 max-md:bg-transparent font-medium"><span className="md:hidden">+</span> Add new {isMobile ? "account" :"bank"}</CustomButton>
    </section>
  )
}

export default BankInfo