import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getFaqs, TFaq } from "@/lib/api/dashboard-apis/faqApis";
import { useQuery } from "@tanstack/react-query";

const Faqs = () => {
  const { data: faqs, isLoading } = useQuery<TFaq[], Error>({
    queryKey: ["faqs"],
    queryFn: getFaqs,
  });

  return (
    <section>
      <div className="pt-10 md:py-24">
        <div className="text-center max-w-[960px] px-5 md:px-20 mx-auto">
          <h1 className="text-[#112929] text-3xl md:text-5xl font-medium mb-6">
            FAQs
          </h1>
          <p className="text-[#475467] text-xl">
            Here you can find answers to your most pressing and commonly asked
            questions about TwiPay and our services.
          </p>
        </div>

        {/* faqs */}
        <div className="max-md:bg-[#F9FAFB] max-w-[768px] mt-16 mx-auto max-md:px-5">
          <Accordion type="single" collapsible>
            {isLoading && (
              <div className="w-full h-[200px] flex items-center justify-center">
                <p className="text-[#344054] font-medium">Loading...</p>
              </div>
            )}
            {!faqs?.length && !isLoading && (
              <div className="w-full h-[200px] flex items-center justify-center">
                <p className="text-[#344054] font-medium">No FAQs available</p>
              </div>
            )}
            {faqs &&
              faqs.length &&
              faqs.map((faq) => (
                <AccordionItem key={faq._id} value={`item-${faq._id}`}>
                  <AccordionTrigger>{faq.question}</AccordionTrigger>
                  <AccordionContent>{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default Faqs;
