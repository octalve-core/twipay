import { activeDashboardLinks } from "@/lib/constants";
import { Link, useLocation } from "react-router-dom";
import SidebarLinkWithSubCat from "./SidebarLinkWithSubCat";
import { cn } from "@/lib/utils";

const DashboardLinks = ({closeSidebar}: {closeSidebar?: () => void}) => {
const location = useLocation();

  return (
    <nav className="flex flex-col h-full overflow-x-hidden overflow-y-auto scroll-bar-y">
        {
            activeDashboardLinks.map(({id, label, link, subCategories, icon: Icon}) => {

                if(subCategories){
                    return <SidebarLinkWithSubCat closeSidebar={closeSidebar} key={id} id={id} label={label} link={link} subCategories={subCategories} icon={Icon} />
                } else {
                    const isActive = location.pathname === link;

                    return (
                        <Link 
                            key={id} 
                            {...(closeSidebar && {onClick: closeSidebar})}
                            className={cn( isActive ? "text-[#112929] font-medium" : "text-[#727884] hover:text-[#112929] transition duration-300")} 
                            to={link}
                        >
                            <div className="w-full h-full px-4 py-3 flex items-center gap-3">
                                <Icon className="size-5" />
                                <span className="text-sm">{label}</span>
                            </div>
                        </Link>
                    )}
            })
        }
    </nav>
  )
}

export default DashboardLinks