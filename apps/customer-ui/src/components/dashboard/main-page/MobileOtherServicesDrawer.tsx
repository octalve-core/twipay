import { Fragment, useState } from "react";
import { Link } from "react-router-dom";

import {
    Sheet,
    SheetContent,
    SheetTrigger,
  } from "@/components/ui/sheet"
  
import { Ellipsis, X } from "lucide-react"
import { activeOtherServicesMobile } from "@/lib/constants";
import ArrowRight from "@/assets/dashboard/arrow-right.svg"

const MobileOtherServicesDrawer = () => {
    const [open, setOpen] = useState(false);

    const closeSidebar = () => setOpen(false)
    
  return (
    <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
        <button className="flex flex-col items-center group">
            <div className="grid place-items-center border-1 border-[#AAAAAA]/20 group-hover:border-[#112929] text-[#112929] bg-white size-[59px] md:size-16 rounded-md cursor-pointer transition">
                <Ellipsis className="size-7" />
            </div>
            <p className="text-[#464E60] text-xs md:text-base">Others</p>
        </button>
        </SheetTrigger>
        <SheetContent side="right" className="md:hidden w-screen bg-white">
            <button onClick={closeSidebar} className="absolute right-8 top-9 size-10 grid place-items-center hover:border rounded-md border-[#1129291A] cursor-pointer">
                <X className="size-6 text-[#334054]" />
            </button>
            <aside>
                <h1 className="md:hidden text-xl text-[#667085] font-medium text-center my-10">Other services</h1>
                <div className="flex flex-col gap-[13px] px-5">
                    {
                        activeOtherServicesMobile.map(({id, href,title,subTitle, icon}) => (
                            <Fragment key={id}>
                                <Link to={href} className="flex items-center gap-4">
                                    <div className="size-12 bg-[#F1F1F1] rounded-full grid place-items-center">
                                        <img src={icon} className="object-cover size-6" />
                                    </div>
                                    <div>
                                        <p className="text-black">{title}</p>
                                        <p className="text-[#717171] text-xs">{subTitle}</p>
                                    </div>
                                    <img src={ArrowRight} className="size-6 object-cover ml-auto" />
                                </Link>
                                <div className="mt-[15px] mb-[13px] h-[0.5px] w-full bg-[#E1E1E1] last-of-type:hidden" />
                            </Fragment>
                        ))
                    }
                </div>
            </aside>
        </SheetContent>
    </Sheet>

  )
}

export default MobileOtherServicesDrawer