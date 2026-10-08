import { Transaction } from "@/lib/api/dashboard-apis/txnHistoryApis"
import SiteLogo from "../../assets/main-pages/logo.png"
import Loader from "../Loader";
import { cn, copyToClipboard, formatAmount, formatDate } from "@/lib/utils";
import { useState } from "react";
import { Check } from "lucide-react";
import { RxCopy } from "react-icons/rx";

const DesktopReceipt = ({txnDetails, fetchingDetails}:{txnDetails: Transaction | undefined, fetchingDetails: boolean}) => {
    const [copied, setCopied] = useState(false);
        
    const copyValue = async (text: string) => {
        await copyToClipboard(text);
        setCopied(true);

        setTimeout(() => {
            setCopied(false)
        }, 2000)
    }

        const time = new Date(txnDetails?.createdAt as string).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        }).replace(" ", "");

    if(fetchingDetails) return <Loader className="w-full h-full max-md:hidden" />;

    (void 0)

  return (
    <div className="hidden md:grid place-items-center min-h-full w-full">
        <section className="w-full max-w-[440px] flex flex-col items-center">
            <div className="w-full flex items-center gap-2 rounded-md text-center py-6 px-4 md:px-16 mb-9 bg-[#F0F5FB]">
                <img className="object-cover w-[91.5px] h-10" src={SiteLogo} alt="TwiPay" />
                <h1 className="text-2xl text-[#112929] font-medium">Transaction receipt</h1>
            </div>

            <section className="w-full text-center bg-white border border-[#1018281A] rounded-xl p-[26px]">
                <h1 className="text-[#717171] mb-3.5 capitalize">{txnDetails?.purpose.replaceAll("_", " ")} - <span className={cn("", txnDetails?.status === "success" ? "text-[#008000]" : "text-[#fb2c36]")}>{txnDetails?.status}!</span></h1>
                <p className="text-[#101828] font-bold text-xl">{txnDetails?.metadata?.country?.currencySymbol ? `${txnDetails.metadata.country.currencySymbol}${txnDetails.amount} ` : formatAmount(txnDetails?.amount as number)}</p>

                <div className="mt-11 w-full flex flex-col justify-center gap-5 text-sm">
                    <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Amount</p>
                        <p className="w-full text-left text-[#101828] font-medium">{txnDetails?.metadata?.country?.currencySymbol ? `${txnDetails.metadata.country.currencySymbol}${txnDetails.amount} ` : formatAmount(txnDetails?.amount as number)}</p>
                    </div>
                    {/* Airtime & Data */}
                    {(txnDetails?.metadata?.phone && txnDetails?.type !== "e_pin") && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Phone number</p>
                        <p className="w-full text-left text-[#101828] font-medium">{txnDetails.metadata?.phone}</p>
                    </div>}
                    {txnDetails?.metadata?.serviceName && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Service Type</p>
                        <p className="w-full text-left text-[#101828] font-medium">{txnDetails.metadata?.serviceName}</p>
                    </div>}
                    {/* Electricity */}
                    {txnDetails?.metadata?.meterNumber && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Meter number</p>
                        <p className="w-full text-left text-[#101828] font-medium">{txnDetails.metadata?.meterNumber}</p>
                    </div>}
                    {txnDetails?.metadata?.meterType && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Meter Type</p>
                        <p className="w-full text-left text-[#101828] font-medium capitalize">{txnDetails.metadata?.meterType}</p>
                    </div>}
                    {/* EPIN */}
                    {txnDetails?.metadata?.profileId && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Profile Id</p>
                        <p className="w-full text-left text-[#101828] font-medium capitalize">{txnDetails.metadata?.profileId}</p>
                    </div>}
                    {/* Betting */}
                    {txnDetails?.metadata?.customerId && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Customer ID</p>
                        <p className="w-full text-left text-[#101828] font-medium capitalize">{txnDetails.metadata?.customerId}</p>
                    </div>}
                    {(txnDetails?.metadata?.serviceCode && txnDetails.type==="betting") && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Platform</p>
                        <p className="w-full text-left text-[#101828] font-medium capitalize">{txnDetails.metadata?.serviceCode}</p>
                    </div>}
                    {/* Cable/Tv */}
                    {txnDetails?.metadata?.smartCardNumber && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Smartcard Number</p>
                        <p className="w-full text-left text-[#101828] font-medium capitalize">{txnDetails.metadata?.smartCardNumber}</p>
                    </div>}
                    {/* Wallet Transactions */}
                    {txnDetails?.metadata?.accountName && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Account Name</p>
                        <p className="w-full text-left text-[#101828] font-medium capitalize">{txnDetails.metadata?.accountName}</p>
                    </div>}
                    {txnDetails?.metadata?.accountNumber && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Account Number</p>
                        <p className="w-full text-left text-[#101828] font-medium capitalize">{txnDetails.metadata?.accountNumber}</p>
                    </div>}
                    {txnDetails?.metadata?.bankName && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Bank Name</p>
                        <p className="w-full text-left text-[#101828] font-medium capitalize">{txnDetails.metadata?.bankName}</p>
                    </div>}
                    {txnDetails?.metadata?.recipientName && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Recipient Name</p>
                        <p className="w-full text-left text-[#101828] font-medium capitalize">{txnDetails.metadata?.recipientName}</p>
                    </div>}
                    {txnDetails?.metadata?.senderUsername && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Sender Username</p>
                        <p className="w-full text-left text-[#101828] font-medium capitalize">{txnDetails.metadata?.senderUsername}</p>
                    </div>}
                    {txnDetails?.metadata?.senderEmail && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Sender Email</p>
                        <p className="w-full text-left text-[#101828] font-medium">{txnDetails.metadata?.senderEmail}</p>
                    </div>}

                    <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Date</p>
                        <p className="w-full text-left text-[#101828] font-medium">{formatDate(txnDetails?.createdAt as string)}</p>
                    </div>
                    <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Time</p>
                        <p className="w-full text-left text-[#101828] font-medium">{time}</p>
                    </div>
                    <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Reference</p>
                        <p className="w-full text-left text-[#101828] font-medium capitalize flex items-center">
                            <span className="truncate w-40">{txnDetails?.reference}</span>
                            <button disabled={copied} onClick={() => copyValue(txnDetails?.reference as string)} className="no-print grid place-items-center cursor-pointer size-[26px] text-[#344054] rounded-[3px]">
                                {copied ? <Check className="text-green-500 size-3" /> : <RxCopy className="size-3 hover:scale-110 transition" />}
                            </button>
                        </p>
                    </div>
                    {(txnDetails?.metadata?.serviceName && txnDetails?.purpose === "data") && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Data Plan</p>
                        <p className="w-full text-left text-[#101828] font-medium">{txnDetails?.metadata?.serviceName}</p>
                    </div>}
                </div>
            </section>
        </section>
    </div>
  )
}

export default DesktopReceipt