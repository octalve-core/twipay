import {  useState } from "react";
import {motion} from "framer-motion"
import { BiMinus, BiPlus } from "react-icons/bi";

import { cn } from "@/lib/utils";
import BackButton from "@/components/Authentication/BackButton";
import { useQuery } from "@tanstack/react-query";
import { getFaqs, TFaq } from "@/lib/api/dashboard-apis/faqApis";

const Faqs = () => {
    const [selectedAccordionId, setSelectedAccordionId] = useState<string | null>(null);

    const { data: faqs, isLoading } = useQuery<TFaq[], Error>({
      queryKey: ["faqs"],
      queryFn: getFaqs,
    });

  return (
    <div className="min-h-full flex md:items-center justify-center">
        <section className="w-full max-w-[410px] mx-auto">
            <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
                <BackButton icon href="/dashboard/settings"/>
                <p className="text-[#667085] font-medium text-xl w-full text-center mr-6">FAQs</p>
            </div>

            <div className="hidden md:block">
                <BackButton href="/dashboard/settings" className="mb-5" />  
                <h1 className="text-[#112929] font-bold text-[28px]">FAQs</h1>
                <p className="text-[#667085]  text-sm mt-1">Answers to some questions</p>
            </div>
            
            <div className="w-full flex flex-col md:items-center gap-5 mt-14 md:mt-5">
                {
                    isLoading && 
                        Array.from({length: 3}).map((_, index) => (
                            <div key={index} className="flex justify-between items-center w-full h-[55px]">
                                <div className="bg-gray-200 h-4 rounded w-[60%]" />
                                <div className="bg-gray-200 size-4 rounded-full" />
                            </div>
                        ))
                    
                }
                {
                    !faqs?.length && !isLoading && (
                        <div className="w-full h-[200px] flex items-center justify-center">
                            <p className="text-[#344054] font-medium">No FAQs available</p>
                        </div>
                    )
                }
                {
                    faqs && faqs.length && faqs.map((faq) => {
                        const isSelected =faq._id === selectedAccordionId;

                        return (
                            <article className="border border-[#D9D9D9]/50 min-h-[55px] px-2 rounded-md hover:bg-[#D9D9D9]/20 transition" key={faq._id}>
                                <div
                                    onClick={() => setSelectedAccordionId(prev => prev === faq._id ? null : faq._id)} 
                                    className="flex justify-between items-center w-full h-[55px] cursor-pointer">
                                    <h3 className="text-[#344054] font-bold">{faq.question}</h3>
                                    <span>{isSelected ? <BiMinus/> :<BiPlus className="" />}</span>
                                </div>
                                <motion.div
                                    initial={{height: 0}} animate={isSelected ? {height: "auto"}: {height: 0}}
                                    className={cn("overflow-hidden w-full")}>
                                    <p className="text-sm text-[#667085] pb-3">{faq.answer}</p>
                                </motion.div>
                            </article>
                        )
                    })
                }
            </div>
        </section>
    </div>
  )
}

export default Faqs