import { whyUseDataarena } from "@/lib/constants";
import { cn } from "@/lib/utils";

const WhyUse = ({ className }: { className?: string }) => {
  return (
    <section className={cn("bg-[#F5F7FF]", className)}>
      <div className="container pt-10 pb-20 md:py-24">
        <div className="text-center max-w-[234px] md:max-w-[768px] mx-auto mb-12 md:mb-16">
          <h2 className="font-medium text-4xl mb-5 text-[#112929]">
            Why Use TwiPay?
          </h2>
          <p className="text-[#475467] md:text-xl">
            What makes us the number one VTU platform in the country
          </p>
        </div>
        <div className="grid grid-cols-3 gap-8">
          {whyUseDataarena.map(({ id, icon, title, content }) => (
            <div
              key={id}
              className="flex flex-col items-center text-center col-span-full md:col-span-1"
            >
              <img className="object-cover size-12" src={icon} />
              <h3 className="mt-5 mb-2 text-[#101828] text-xl font-medium">
                {title}
              </h3>
              <p className="text-[#475467] ">{content}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyUse;
