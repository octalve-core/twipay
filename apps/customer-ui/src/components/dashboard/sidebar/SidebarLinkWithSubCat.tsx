import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { IconType } from 'react-icons/lib';
import { Link, useLocation } from 'react-router-dom';

type TSidebarLinkWithSubCat = {
  id: number;
  label: string;
  link: string;
  icon: IconType;
  closeSidebar?: () => void;
  subCategories: { id: number; label: string; href: string }[];
};

const SidebarLinkWithSubCat = ({id, label, link, icon: Icon, subCategories, closeSidebar}: TSidebarLinkWithSubCat) => {
  const location = useLocation();
  const isActive = location.pathname === link || location.pathname.startsWith(`${link}/`);
  const [showSubCat, setShowSubCat] = useState(isActive);
  const menuId = `sidebar-subcategories-${id}`;

  // Deep links and browser back/forward must reveal the currently selected child.
  useEffect(() => { if (isActive) setShowSubCat(true); }, [isActive, location.pathname]);

  return (
    <div className="flex flex-col">
      <div className={cn('flex items-center', isActive ? 'text-[#112929] font-medium' : 'text-[#727884] hover:text-[#112929] transition duration-300')}>
        <Link to={link} onClick={() => { setShowSubCat(true); closeSidebar?.(); }}
          className="flex-1 min-w-0 px-4 py-3 flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#112929]"
          aria-current={location.pathname === link ? 'page' : undefined}>
          <Icon className="size-5" />
          <span className="text-sm">{label}</span>
        </Link>
        <button type="button" aria-label={`${showSubCat ? 'Collapse' : 'Expand'} ${label} submenu`}
          aria-expanded={showSubCat} aria-controls={menuId} onClick={() => setShowSubCat(value => !value)}
          className="mr-2 p-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#112929]">
          <ChevronDown className={cn('size-5 transition duration-500', showSubCat && 'rotate-180')} aria-hidden="true" />
        </button>
      </div>
      <motion.div id={menuId} initial={false} animate={showSubCat ? {height:'auto'} : {height:0}}
        aria-hidden={!showSubCat}
        className="flex gap-3.5 pl-6 overflow-hidden">
        <div className="h-full w-[1px] bg-[#D8D9D4]" />
        <ul className="flex flex-col w-full">
          {subCategories.map(({id: childId, label: itemLabel, href}) => {
            const selected = location.pathname === href;
            return <li key={childId} className="w-full">
              <Link to={href} onClick={closeSidebar} tabIndex={showSubCat ? undefined : -1} aria-current={selected ? 'page' : undefined}
                className={cn('w-full text-left py-3 px-4 text-sm hover:text-black transition cursor-pointer inline-block rounded-md focus-visible:outline-2 focus-visible:outline-[#112929]', selected ? 'text-black' : 'text-[#727884]')}>
                {itemLabel}
              </Link>
            </li>;
          })}
        </ul>
      </motion.div>
    </div>
  );
};

export default SidebarLinkWithSubCat;
