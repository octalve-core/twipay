import { Link } from "react-router-dom";

import { settingsData } from "@/lib/constants";
import {  HiOutlineChevronRight } from "react-icons/hi2";
import { cn } from "@/lib/utils";
import DeactivateAccount from "./DeactivateAccount";
import LogOutAccount from "./LogOutAccount";

const Settings = () => {
  return (
    <section className="mt-6 md:mt-[39px] md:bg-white w-full rounded-[10px] md:border border-[#F0F2F5]">
        <div className="w-full max-w-[588px] mx-auto flex flex-col gap-4 md:gap-8 md:p-6">
            {
                settingsData.map(({id, title, subTitle, path, hasVerifiedTag, icon: Icon}) => (
                    <Link key={id} to={`${path}`} className="flex items-center justify-between w-full group bg-white md:bg-transparent rounded-lg md:rounded-none max-md:p-2">
                        <div className="flex items-center gap-4">
                            <span className={cn("size-10 md:size-12 bg-[#11292905] grid place-items-center rounded-md md:rounded-full text-[#112929]", id === 6 && "bg-[#FF00000A] text-[#FF0000]")}>
                                <Icon className="w-4 md:w-[22px] h-4 md:h-[18px]" />
                            </span>
                            <div className="">
                                <h2 className="text-[#101928] font-medium md:font-bold">{title}</h2>
                                <p className="hidden md:flex items-center gap-1 text-xs">
                                    <span className="text-[#667185]">{subTitle}</span>
                                    {hasVerifiedTag && <span className="bg-[#E7F6EC] py-0.5 px-2 rounded-[10px] font-medium text-[#0F973D] text-xs">Verified</span>}
                                </p>
                            </div>
                        </div>

                        <HiOutlineChevronRight className="hidden md:block size-5 text-[#112929]" />
                    </Link>
                ))
            }
            <LogOutAccount />
            <DeactivateAccount />
        </div>
    </section>
  )
}

export default Settings;