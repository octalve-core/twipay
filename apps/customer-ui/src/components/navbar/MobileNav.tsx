import { Menu, X } from "lucide-react"
import Logo from "./Logo"
import { useState } from "react"
import { navlinks } from "@/lib/constants"
import { NavLink } from "react-router-dom"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import Mobile_app_store_Apple from "../../assets/main-pages/Mobile app store badge Apple.png" 
import Mobile_app_store_Google from "../../assets/main-pages/Mobile app store badge Google.png" 
import AuthButtons from "../Authentication/AuthButtons"
import { brand } from "@/config/brand";

const MobileNav = () => {
const [showMobileNav, setShowMobileNav] = useState(false)

  return (
    <>
      {
        // !showMobileNav && (
          <div className="flex md:hidden justify-between items-center p-4 bg-white h-full">
            <Logo />
            <Sheet open={showMobileNav} onOpenChange={setShowMobileNav}>
              <SheetTrigger asChild>
                <button type="button" aria-label="Open site menu" className="size-10 grid place-items-center border rounded-md border-[#1129291A] cursor-pointer">
                  <Menu className="size-6 text-[#112929]" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-screen max-w-full">
                <SheetTitle className="sr-only">Site menu</SheetTitle>
                <SheetDescription className="sr-only">Navigate {brand.name} public pages</SheetDescription>
                <div className="w-full h-dvh overflow-y-auto bg-[#F5F7FF] flex flex-col justify-between px-4 pb-14 pt-10">
                  <div className="flex flex-col justify-between h-[52px]">
                    <div className="flex justify-between items-end p-4 h-full border-b border-[#1129291A]">
                      <Logo />
                      <button type="button" aria-label="Close site menu" onClick={() => setShowMobileNav(false)} className="size-10 grid place-items-center border rounded-md border-[#1129291A] cursor-pointer">
                        <X className="size-6 text-[#112929]" />
                      </button>
                    </div>
                    <ul className="flex flex-col gap-5 mt-8 mb-10">
                        {
                            navlinks.map(({id, label, href}) => {
                                return (
                                    <li onClick={() => setShowMobileNav(false)} key={id} >
                                        <NavLink className={({isActive}) =>
                                            !isActive ? "text-[#475467] font-normal hover:bg-[#1129290D] transition" : "text-[#112929] font-medium"
                                        } to={href}>{label}</NavLink>
                                    </li>
                                )
                            })
                        }
                    </ul>
                    <AuthButtons />
                  </div>
                  <div className="flex items-center gap-2.5 w-full justify-center">
                    <span title="iOS app not yet available">
                      <img className="w-[120px] h-[40px]" src={Mobile_app_store_Apple} alt="iOS app coming later" />
                    </span>
                    <span title="Android app not yet available">
                      <img className="w-[120px] h-[40px]" src={Mobile_app_store_Google} alt="Android app coming later" />
                    </span>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        // )
      }
    </>
  )
}

export default MobileNav