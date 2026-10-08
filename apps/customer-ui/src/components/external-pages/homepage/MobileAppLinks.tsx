import { cn } from "@/lib/utils";
import Mobile_app_store_Apple from "../../../assets/main-pages/Mobile app store badge Apple.png";
import Mobile_app_store_Google from "../../../assets/main-pages/Mobile app store badge Google.png";

const MobileAppLinks = ({ className }: { className?: string }) => {
  return (
    <section className={cn("bg-[#F5F7FF]", className)}>
      <div className="py-12 md:py-20 text-center max-w-[1153px] mx-auto md:px-24">
        <p className="text-[#112929] font-medium text-xl md:text-4xl px-5">
          At TwiPay, we&apos;re more than just a service provider; we&apos;re a
          community. We invite you to join us on our journey to make digital
          transactions simpler and more accessible for everyone.
        </p>
        <div className="flex items-center gap-2.5 w-full justify-center mt-8 md:mt-16">
          <button className="cursor-pointer">
            <img
              className="w-[120px] h-[40px] md:w-[193px] md:h-[57px] "
              src={Mobile_app_store_Apple}
            />
          </button>
          <button className="cursor-pointer">
            <img
              className="w-[120px] h-[40px] md:w-[193px] md:h-[57px] "
              src={Mobile_app_store_Google}
            />
          </button>
        </div>
      </div>
    </section>
  );
};

export default MobileAppLinks;
