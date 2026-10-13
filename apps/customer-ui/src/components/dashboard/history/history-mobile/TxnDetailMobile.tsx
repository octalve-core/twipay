import Loader from "@/components/Loader";
import { Transaction, formatTransactionAmount } from "@/lib/api/dashboard-apis/txnHistoryApis";
import { copyToClipboard, formatDateTime, getTxnTime } from "@/lib/utils";
import { parseISO } from "date-fns";
import { ArrowLeft, Check } from "lucide-react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import CustomButton from "@/components/CustomButton";
import { LuDownload } from "react-icons/lu";
import { useState } from "react";
import { RxCopy } from "react-icons/rx";

const TxnDetailMobile = ({txnDetails, fetchingDetails}:{txnDetails: Transaction | undefined, fetchingDetails: boolean}) => {
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

    const txnDate = txnDetails ? parseISO(txnDetails?.createdAt) : new Date();
    const txnTime = getTxnTime(txnDate);

    const downloadReceipt = async () => {
        const element = document.getElementById("receipt-content-mobile");
        if (!element) return;

        // Use html2canvas to render the element to canvas
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true, // Enable if you have external images/icons
            ignoreElements: (el) => {
                return el.classList.contains("no-print");
            },
        });

        void 0;

        const imgData = canvas.toDataURL("image/jpeg", 1.0); // High quality JPEG
        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "px",
            format: [canvas.width, canvas.height],
        });

        pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
        pdf.save("receipt.pdf");
    };

    if(fetchingDetails) return <Loader className="md:hidden w-full h-full" />;

  return (
    <div className="md:hidden w-full">
        <div id="receipt-content-mobile" className="absolute top-0 left-0 w-full h-full">
            <header className="py-5 w-full bg-[#112929] text-[#fff] px-5 flex flex-col justify-center">
                <div className="flex items-center mb-10 mt-2 md:hidden">
                    <div className="no-print">
                        <Link to="/dashboard/history">
                            <ArrowLeft className="size-6" /> 
                        </Link>
                    </div>
                    <p className="font-medium text-xl w-full text-center mr-6">{txnTime} {time}</p>
                </div>
                <p className="text-2xl font-medium text-center">{txnDetails?.description}</p>
            </header>

            <section className="bg-white mx-auto w-[90vw] mt-5 rounded-lg p-2.5 flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Total amount</p>
                    <p className="font-medium">{txnDetails ? formatTransactionAmount(txnDetails) : "—"}</p>
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
{txnDetails?.metadata?.customerId && <div className="flex items-center justify-between text-sm text-[#464E60]">
                    <p className="">Customer ID</p>
                    <p className="font-medium capitalize">{txnDetails.metadata?.customerId}</p>
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
            <CustomButton onClick={() => downloadReceipt()} className="flex items-center gap-3 mx-auto w-[90vw] mt-9 justify-center font-medium md:text-lg no-print">
                <LuDownload className="size-6" />
                <span>Download Receipt</span>
            </CustomButton>
         </div>
    </div>
  )
}

export default TxnDetailMobile