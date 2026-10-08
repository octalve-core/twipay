import { Transaction } from "@/lib/api/dashboard-apis/txnHistoryApis"
import { FaLongArrowAltDown, FaLongArrowAltUp } from "react-icons/fa";
import Loader from "../Loader";
import { copyToClipboard, formatAmount, formatDateTime } from "@/lib/utils";
import { useState } from "react";
import { Check } from "lucide-react";
import { RxCopy } from "react-icons/rx";

const MobileReceipt = ({txnDetails, fetchingDetails}:{txnDetails: Transaction | undefined, fetchingDetails: boolean}) => {
    const [copied, setCopied] = useState(false);
        
    const copyValue = async (text: string) => {
        await copyToClipboard(text);
        setCopied(true);

        setTimeout(() => {
            setCopied(false)
        }, 2000)
    }

    const txnLogo = txnDetails?.metadata?.logo;
    const txnType = txnDetails?.type;
    const purpose = txnDetails?.purpose;
    // const provider = txnDetails?.metadata.provider?.name || txnDetails?.purpose;
    const remark = txnDetails?.description;

    if(fetchingDetails) return <Loader className="md:hidden w-full h-full" />;

  return (
    <section className="w-full max-w-[90vw] md:hidden">
        <header className="bg-[#112929] rounded-[5px] pt-9 pb-[18px] w-full relative">
            <div className="bg-white w-fit flex items-center gap-2.5 rounded-[211px] p-3.5 absolute left-1/2 -translate-x-1/2 -top-0 -translate-y-[30px]">
                <div className="grid place-items-center size-[30px] rounded-full">
                    {(purpose === "transfer" || purpose=== "deposit") && <>
                        {
                        txnType === "credit" ? (
                        <div className="size-full bg-[#E7F6EC] rounded-full grid place-items-center">
                            <FaLongArrowAltDown className="w-2 h-4 text-[#0F973D]" />
                        </div>
                        ) : txnType === "debit" ? (
                        <div className="size-full bg-[#FBEAE9] rounded-full grid place-items-center">
                            <FaLongArrowAltUp className="w-2 h-4 text-[#D42620]" />
                        </div>
                        ) : null
                    }
                    </>}
                    {txnLogo && <img src={txnLogo} className="size-full rounded-full object-cover" />}
                </div>
                <span className="text-lg capitalize shrink-0">{txnDetails?.metadata?.serviceName?.replaceAll("_", " ").replace("Airtime", "")}</span>
            </div>
            <h1 className="text-white font-medium text-xl text-center">{remark}</h1>
        </header>

        <section className="flex flex-col mt-4 p-2.5 gap-3 text-sm text-[#464E60]">
                <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Total amount</p>
                    <p className="font-medium">{txnDetails?.metadata?.country?.currencySymbol ? `${txnDetails.metadata.country.currencySymbol}${txnDetails.amount} ` : formatAmount(txnDetails?.amount as number)}</p>
                </div>
                <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Transaction type</p>
                    <p className="font-medium capitalize">{txnDetails?.purpose.replaceAll("_", " ")}</p>
                </div>
                {/* Electricity */}
                {txnDetails?.metadata?.meterNumber && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Meter Number</p>
                    <p className="font-medium capitalize">{txnDetails.metadata?.meterNumber}</p>
                </div>}
                {txnDetails?.metadata?.meterType && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Meter Type</p>
                    <p className="font-medium capitalize">{txnDetails.metadata?.meterType}</p>
                </div>}
                {/* Airtime & Data */}
                {(txnDetails?.metadata?.phone && txnDetails.type !== "e_pin") && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Phone number</p>
                    <p className="font-medium capitalize">{txnDetails.metadata?.phone}</p>
                </div>}
                {/* Epin */}
                {txnDetails?.metadata?.serviceName && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Service Type</p>
                    <p className="font-medium capitalize">{txnDetails.metadata?.serviceName}</p>
                </div>}
                {txnDetails?.metadata?.profileId && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Profile ID</p>
                    <p className="font-medium capitalize">{txnDetails.metadata?.profileId}</p>
                </div>}
                {/* Cable/Tv */}
                {txnDetails?.metadata?.smartCardNumber && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Smartcard Number</p>
                    <p className="font-medium capitalize">{txnDetails.metadata?.smartCardNumber}</p>
                </div>}
                {/* Betting */}
                {txnDetails?.metadata?.customerId && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Customer ID</p>
                    <p className="font-medium capitalize">{txnDetails.metadata?.customerId}</p>
                </div>}
                {(txnDetails?.type === "betting" && txnDetails?.metadata?.serviceCode) && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Platform</p>
                    <p className="font-medium capitalize">{txnDetails.metadata?.serviceCode}</p>
                </div>}
                {/* Wallet Transactions */}
                {txnDetails?.metadata?.accountName && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Account Name</p>
                    <p className="font-medium capitalize">{txnDetails.metadata?.accountName}</p>
                </div>}
                {txnDetails?.metadata?.accountNumber && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Account Number</p>
                    <p className="font-medium capitalize">{txnDetails.metadata?.accountNumber}</p>
                </div>}
                {txnDetails?.metadata?.bankName && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Bank Name</p>
                    <p className="font-medium capitalize">{txnDetails.metadata?.bankName}</p>
                </div>}
                {txnDetails?.metadata?.recipientName && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Recipient Name</p>
                    <p className="font-medium capitalize">{txnDetails.metadata?.recipientName}</p>
                </div>}
                {txnDetails?.metadata?.senderUsername && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Sender Username</p>
                    <p className="font-medium capitalize">{txnDetails.metadata?.senderUsername}</p>
                </div>}
                {txnDetails?.metadata?.senderEmail && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Sender Email</p>
                    <p className="font-medium">{txnDetails.metadata?.senderEmail}</p>
                </div>}

                <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Status</p>
                    <p className="font-medium">{txnDetails?.status}</p>
                </div>
                <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Date/Time</p>
                    <p className="font-medium">{formatDateTime(txnDetails?.createdAt as string)}</p>
                </div>
                <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Reference</p>
                    <p className="font-medium capitalize flex items-center">
                        <span className="truncate w-40">{txnDetails?.reference}</span>
                        <button disabled={copied} onClick={() => copyValue(txnDetails?.reference as string)} className="no-print grid place-items-center cursor-pointer size-[26px] text-[#344054] rounded-[3px]">
                            {copied ? <Check className="text-green-500 size-3" /> : <RxCopy className="size-3 hover:scale-110 transition" />}
                        </button>
                    </p>
                </div>
                
            </section>
    </section>
  )
}

export default MobileReceipt