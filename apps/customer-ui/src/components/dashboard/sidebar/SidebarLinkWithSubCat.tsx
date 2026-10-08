import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import {motion} from "framer-motion"

import { IconType } from 'react-icons/lib';
import { Link, useLocation } from 'react-router-dom';

type TSidebarLinkWithSubCat = {
    id: number;
    label: string;
    link: string;
    icon: IconType;
    closeSidebar?: () => void
    subCategories: { id: number; label: string, href: string }[];
}

const SidebarLinkWithSubCat = ({id, label, link, icon: Icon, subCategories, closeSidebar}: TSidebarLinkWithSubCat) => {
    const [showSubCat, setShowSubCat] = useState(false);
    const location = useLocation();

    const isActive = location.pathname.includes("/dashboard/services");

  return (
    <div className="flex flex-col">
        <Link 
            onClick={() => {
                setShowSubCat(prev => !prev);
            }} 
            key={id} 
            className={cn(" flex items-center", isActive ? "text-[#112929] font-medium" : "text-[#727884] hover:text-[#112929] transition duration-300")} 
            to={link}
        >
            <div className="w-full h-full px-4 py-3 flex items-center gap-3">
                <Icon className="size-5" />
                <span className="text-sm">{label}</span>
            </div>
            <ChevronDown className={cn('size-5 transition duration-500 mr-5', showSubCat && "rotate-180")} />
        </Link>

        <motion.div 
            initial={{ height: 0}}
            animate={showSubCat ? { height: "auto"} : { height: 0}}
            className={cn("flex gap-3.5 pl-6 overflow-hidden")}>
            <div className='h-full w-[1px] bg-[#D8D9D4]' />
            <ul className="flex flex-col w-full">
                {
                    subCategories.map(({id, label, href}) => {
                        const isActive = location.pathname.includes(href);
                        return <li {...(closeSidebar && {onClick: closeSidebar})} key={id} className='w-full'>
                                    <Link to={href} className={cn('w-full text-left py-3 px-4 text-sm hover:text-black transition cursor-pointer inline-block', isActive ? "text-black" : "text-[#727884]")}>
                                        {label}
                                    </Link> 
                                </li>
                    })
                }
            </ul>
        </motion.div>
    </div>
  )
}

export default SidebarLinkWithSubCat