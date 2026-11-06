import { useState } from "react";
import { LuMenu } from "react-icons/lu";

import {
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetTitle,
    SheetDescription,
  } from "@/components/ui/sheet"
import Sidebar from "./sidebar/Sidebar"
import { X } from "lucide-react";
import { brand } from "@/config/brand";
  
const MobileNavigation = () => {
    const [open, setOpen] = useState(false);

    const closeSidebar = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" aria-label="Open dashboard menu" className="cursor-pointer text-[#667185] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#112929] rounded-md"><LuMenu className="size-7" /></button>
      </SheetTrigger>
      <SheetContent side="right" className="md:hidden w-[85vw] overflow-y-auto">
        <SheetTitle className="sr-only">Dashboard menu</SheetTitle>
        <SheetDescription className="sr-only">Navigate {brand.name} dashboard pages</SheetDescription>
        <button type="button" aria-label="Close dashboard menu" onClick={() => setOpen(false)} className="absolute right-8 top-9 size-10 grid place-items-center hover:border rounded-md border-[#1129291A] cursor-pointer">
            <X className="size-6 text-[#334054]" />
        </button>
        <Sidebar closeSidebar={closeSidebar} />
      </SheetContent>
    </Sheet>

  )
}

export default MobileNavigation