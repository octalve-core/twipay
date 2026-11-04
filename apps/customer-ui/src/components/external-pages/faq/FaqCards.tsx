import { faqCards } from "@/lib/constants"

import AvatarGroup from "@/assets/main-pages/Avatar group.png"
import CustomButton from "@/components/CustomButton"

const FaqCards = () => {
  return (
    <section className="bg-[#F9FAFB]">
        <div className="container pt-10 md:pt-20 md:pb-14">
            <div className="grid grid-cols-3 gap-y-16 gap-x-8">
                {
                    faqCards.map(({id, question, answer, icon}) => (
                        <div key={id} className="flex flex-col items-start text-left col-span-full md:col-span-1">
                            <img alt="" className="object-cover size-12" src={icon} />
                            <h3 className="mt-5 mb-2 text-[#112929] text-xl font-medium">{question}</h3>
                            <p className="text-[#667085] ">{answer}</p>
                        </div>
                    ))
                }
            </div>

            <div className="flex flex-col items-center text-center py-10 md:mt-16">
                <img alt="" src={AvatarGroup} className="object-cover w-[120px] h-[56px]"/>
                <h4 className="text-[#101828] font-medium text-lg mt-4 mb-1">Still have questions?</h4>
                <p className="text-[#475467] mb-8">Can&apos;t find the answer you&apos;re looking for? Please chat to our friendly team.</p>
                <CustomButton href="/contact">Contact Us</CustomButton>
            </div>
        </div>
    </section>
  )
}

export default FaqCards