import { copyToClipboard } from "@/lib/utils";
import { Check, Link } from "lucide-react"
import { useEffect, useState } from "react"

import UserImage from "@/assets/dashboard/userImage.png"
import useBackButtonStore from "@/stores/useBackButtonStore";
import BackButton from "@/components/Authentication/BackButton";

const Referral = () => {
    const [copied, setCopied] = useState(false);
    const linkText = "app.Dataarena.link/qwert11";

    const {setButtonUrl} = useBackButtonStore();
  
    useEffect(() => {
        setButtonUrl("/dashboard/affiliate");

        return () => {
          setButtonUrl(null);
        };
      }, [setButtonUrl]);

    const copyLink = async (text: string) => {
        await copyToClipboard(text);
        setCopied(true);

        setTimeout(() => {
            setCopied(false)
        }, 2000)
    }

  return (
    <section className="w-full max-w-[596px] mx-auto">
        <div className="flex items-center mb-7 mt-2 md:hidden">
            <BackButton icon href="/dashboard/affiliate"/>
            <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Referrals</p>
        </div>

        <div className="max-md:hidden">
            <h1 className="text-[#112929] font-medium text-2xl text-center">Referral</h1>
        </div>
        <p className="text-[#344054] md:text-[#717171] mt-2 md:text-center mb-6 md:mb-8 max-md:font-medium max-md:text-xl">Increase your earnings by referring more people!</p>
        <div className="flex flex-col gap-1.5">
            <h2 className="text-[#344054] max-md:text-sm">Referral link</h2>
            <div className="flex items-center justify-between bg-white rounded-lg py-2.5 px-3.5 border-[0.5px] border-[#D0D5DD]">
                <p className="text-[#667085] text-sm md:text-xl">{linkText}</p>
                {
                    copied ?
                        ( 
                            <button disabled className="cursor-pointer">
                                <Check className="text-green-500 size-4" />
                            </button>
                        ) 
                            :
                        (
                            <button onClick={() => copyLink(linkText)} className="cursor-pointer">
                                <Link className="text-[#344054] size-4 hover:scale-110 transition" />
                            </button>
                        )
                }
            </div>
        </div>

        <div className="mt-5 md:text-xl flex items-center gap-1 ">
            <span className="text-[#344054] font-medium">Referral code:</span>
            <span className="text-[#112929] font-medium">qwert11</span>
        </div>

        <div className="flex items-center justify-between bg-[#00128F] mt-5 text-white gap-2 rounded-lg py-4 px-5">
            <div className="flex flex-col">
                <h4 className="md:font-medium md:text-xl">People referred</h4>
                <p className="font-bold md:text-2xl">120</p>
            </div>
            <div className="flex flex-col text-right">
                <h4 className="md:font-medium md:text-xl">Amount earned</h4>
                <p className="font-bold md:text-2xl">₦12,000</p>
            </div>
        </div>

        <div className="mt-8">
            <h3 className="text-[#344054] font-medium">Referral list</h3>
            <div className="flex flex-col gap-1 mt-2 md:mt-3">
                {
                    Array.from({length: 5}).map((_, i) => (
                        <div key={i} className="flex items-center justify-between bg-white rounded-lg py-2.5 px-3">
                            <div className="flex items-center gap-2">
                                <div className="relative bg-[#F8F8F8] size-[36px] md:size-10 rounded-full grid place-items-center">
                                    <img className="size-[36px] md:size-10" src={UserImage} />
                                    <div className="size-2 bg-[#12B76A] rounded-full absolute right-0 bottom-0 z-10" />
                                </div>
                                <div className="text-xs md:text-sm">
                                    <p className="text-[#1C1C1CCC] md:text-[#667085] max-md:md:text-sm max-md:font-medium">Benny Atashe</p>
                                    <p className="text-[#667085CC]">08/15/2024</p>
                                </div>
                            </div>
                            
                            <div className="text-xs md:text-sm text-right">
                                <p className="text-[#667085]">08/13/2024</p>
                                <p className="text-[#008000]">Success</p>
                            </div>
                        </div>
                    ))
                }
            </div>
        </div>
    </section>
  )
}

export default Referral