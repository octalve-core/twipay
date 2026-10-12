import { copyToClipboard } from "@/lib/utils";
import { Check } from "lucide-react";
import { useState } from "react";
import { RxCopy } from "react-icons/rx";

type TAccountCardItem = {
    title: string;
    value: string;
}

const AccountCardItem = ({title, value}: TAccountCardItem) => {
    const [copied, setCopied] = useState(false);

    const copyValue = async (text: string) => {
        await copyToClipboard(text);
        setCopied(true);

        setTimeout(() => {
            setCopied(false)
        }, 2000)
    }

  return (
    <div className="flex items-center justify-between">
        <div className="flex flex-col text-[#464E60] text-sm md:text-lg">
            <p className="opacity-70">{title}</p>
            <p className="font-medium -mt-1">{value}</p>
        </div>

        <button disabled={copied} onClick={() => copyValue(value)} className="grid place-items-center cursor-pointer size-[26px] text-[#344054] rounded-[3px]">
            {copied ? <Check className="text-green-500 size-4" /> : <RxCopy className="size-4 hover:scale-110 transition" />}
        </button>
    </div>
  )
}

export default AccountCardItem