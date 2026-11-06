import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { brand } from "@/config/brand";

const MobileAppLinks = ({ className }: { className?: string }) => {
  return (
    <section className={cn("bg-[#F5F7FF]", className)}>
      <div className="py-12 md:py-20 text-center max-w-[1153px] mx-auto md:px-24">
        <p className="text-[#112929] font-medium text-xl md:text-4xl px-5">
          Your everyday money moments deserve a simpler experience.
          Get started with {brand.name} and keep your account in view.
        </p>
        <div className="flex items-center gap-2.5 w-full justify-center mt-8 md:mt-16">
          <Link to="/auth/signup" className="bg-[#112929] text-white rounded-lg px-6 py-3 font-medium hover:opacity-90">Get started</Link>
          <Link to="/auth/login" className="border border-[#112929] text-[#112929] rounded-lg px-6 py-3 font-medium hover:bg-white">Log in</Link>
        </div>
      </div>
    </section>
  );
};

export default MobileAppLinks;
