import { useState } from "react";
import { LuMenu } from "react-icons/lu";

import {
    Sheet,
    SheetContent,
    SheetTrigger,
  } from "@/components/ui/sheet"
import Sidebar from "./sidebar/Sidebar"
import { X } from "lucide-react";
  
const MobileNavigation = () => {
    const [open, setOpen] = useState(false);

    const closeSidebar = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button onClick={() => setOpen(false)} className="cursor-pointer text-[#667185]"><LuMenu className="size-7" /></button>
      </SheetTrigger>
      <SheetContent side="right" className="md:hidden w-[85vw]">
        <button onClick={() => setOpen(false)} className="absolute right-8 top-9 size-10 grid place-items-center hover:border rounded-md border-[#1129291A] cursor-pointer">
            <X className="size-6 text-[#334054]" />
        </button>
        <Sidebar closeSidebar={closeSidebar} />
      </SheetContent>
    </Sheet>

  )
}

export default MobileNavigation