import { HiOutlineChevronRight } from 'react-icons/hi';
import { IoClose } from 'react-icons/io5';
import { brand } from "@/config/brand";

// Financial accounts require a reviewed closure/retention policy. The original
// ErhaPay row remains recognizable, but intentionally provides no destructive action.
export default function DeactivateAccount() {
  return (
    <div className="flex items-center justify-between w-full bg-white md:bg-transparent rounded-lg md:rounded-none max-md:p-2 opacity-70" aria-describedby="account-closure-unavailable">
      <div className="flex items-center gap-4">
        <span className="size-10 md:size-12 grid place-items-center rounded-md md:rounded-full bg-[#FF00000A] text-[#FF0000]">
          <IoClose className="w-4 md:w-[22px] h-4 md:h-[18px]" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[#101928] font-medium md:font-bold text-left">Account closure</h2>
          <p id="account-closure-unavailable" className="text-xs text-[#667185]">Self-service closure is not available yet. Contact {brand.name} support for assistance.</p>
        </div>
      </div>
      <HiOutlineChevronRight className="hidden md:block size-5 text-[#98A2B3]" aria-hidden="true" />
    </div>
  );
}
