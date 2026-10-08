import { CiFilter } from "react-icons/ci";

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import ApplyFilters from "./ApplyFilters";
import { useState } from "react";
import { BsSliders2Vertical } from "react-icons/bs";
import useIsMobile from "@/hooks/useIsMobile";

const Filterbutton = () => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger>
        <div className="max-md:hidden flex items-center gap-1 text-sm text-[#112929] rounded-[4px] py-2 px-3 transition cursor-pointer bg-white hover:bg-[#1129290D]">
            <CiFilter className="size-5" />
            <span className="font-medium max-md:hidden">Filter</span>
        </div>
        <div className="md:hidden size-9 rounded-full bg-white grid place-items-center shrink-0">
            <BsSliders2Vertical className="text-[#101828] size-5" />
          </div>
      </SheetTrigger>
      <SheetContent side={isMobile ? "bottom" : "right"} className="bg-white border-none rounded-tl-xl max-md:rounded-tr-xl sm:max-w-[410px] max-md:h-[85vh]">
        <ApplyFilters setOpen={setOpen} />
      </SheetContent>
    </Sheet>

  )
}

export default Filterbutton