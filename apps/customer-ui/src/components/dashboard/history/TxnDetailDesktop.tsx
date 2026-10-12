import BackButton from "@/components/Authentication/BackButton"
import Loader from "@/components/Loader";
import { cn, copyToClipboard, formatDate, formatDateTime } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import CustomButton from "@/components/CustomButton";
import { LuDownload } from "react-icons/lu";
import { Transaction, formatTransactionAmount } from "@/lib/api/dashboard-apis/txnHistoryApis";
import { useState } from "react";
import { Check } from "lucide-react";
import { RxCopy } from "react-icons/rx";

const TxnDetailDesktop = ({txnDetails, fetchingDetails}:{txnDetails: Transaction | undefined, fetchingDetails: boolean}) => {
    const [copied, setCopied] = useState(false);
    
    const copyValue = async (text: string) => {
        await copyToClipboard(text);
        setCopied(true);

        setTimeout(() => {
            setCopied(false)
        }, 2000)
    }
    const navigate = useNavigate();

    const date = formatDateTime(txnDetails?.createdAt as string);
    const time = new Date(txnDetails?.createdAt as string).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }).replace(" ", "");

    const downloadReceipt = async () => {
        const element = document.getElementById("receipt-content-desktop");
        if (!element) return;

        // Use html2canvas to render the element to canvas
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true, // Enable if you have external images/icons
            ignoreElements: (el) => {
                return el.classList.contains("no-print");
            },
        });

        const padding = 24;

        const imgData = canvas.toDataURL("image/jpeg", 1.0); // High quality JPEG
        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "px",
            format: [canvas.width + padding * 2, canvas.height + padding * 2],
        });

        pdf.addImage(imgData, "JPEG", padding, padding, canvas.width, canvas.height);
        pdf.save("receipt.pdf");
    };

    if(fetchingDetails) return <Loader className="w-full h-full max-md:hidden" />;

  return (
    <div className="max-md:hidden h-full w-[440px]">
        <BackButton action={() => navigate(-1)} className="mr-auto mb-7" />

        <div className="w-full h-full" id="receipt-content-desktop">
            <header className="w-full rounded-md text-center py-6 px-4 md:px-16 mb-9 bg-[#F0F5FB] text-[#112929]">
                <p className="font-medium text-sm mb-3">{date}</p>
                <p className="font-medium">{txnDetails?.description}</p>
            </header>

            <section className="w-full text-center bg-white border border-[#1018281A] rounded-xl p-[26px]">
                <h1 className="text-[#717171] mb-3.5 capitalize">{txnDetails?.purpose?.replaceAll("_", " ")} - <span className={cn("", txnDetails?.status === "success" ? "text-[#008000]" : (txnDetails?.status === "pending" || txnDetails?.status === "processing") ? "text-yellow-500" : "text-[#fb2c36]" )}>{txnDetails?.status}!</span></h1>
                <p className="text-[#101828] font-bold text-xl">{txnDetails ? formatTransactionAmount(txnDetails) : "—"}</p>

                <div className="mt-11 w-full flex flex-col justify-center gap-5 text-sm">
                    <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Amount</p>
                        <p className="w-full text-left text-[#101828] font-medium">{txnDetails ? formatTransactionAmount(txnDetails) : "—"}</p>
                    </div>
                    {/* Airtime & Data */}
                    {(txnDetails?.metadata?.phone && txnDetails?.type !== "e_pin") && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Phone number</p>
                        <p className="w-full text-left text-[#101828] font-medium">{txnDetails.metadata.phone}</p>
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
{txnDetails?.metadata?.customerId && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Customer ID</p>
                        <p className="w-full text-left text-[#101828] font-medium capitalize">{txnDetails.metadata?.customerId}</p>
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
                    {/* {txnDetails?.metadata?.recipientUsername && <div className="flex justify-center gap-5">
                        <p className="w-full text-[#717171] text-right">Recipient Username</p>
                        <p className="w-full text-left text-[#101828] font-medium capitalize">{txnDetails.metadata?.recipientUsername}</p>
                    </div>} */}

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
        </div>
        {txnDetails && txnDetails.status !== "success" && <p role="status" className="mt-5 text-amber-700">This transaction is {txnDetails.status}. This record is not proof of successful payment.</p>}
        <CustomButton disabled={!txnDetails || txnDetails.status !== "success"} onClick={() => downloadReceipt()} className="flex items-center gap-3 w-full mt-9 justify-center font-medium md:text-lg">
            <LuDownload className="size-6" />
            <span>Download Receipt</span>
        </CustomButton>
    </div>
  )
}

export default TxnDetailDesktop