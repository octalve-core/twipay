import Logo from "@/components/navbar/Logo";
import DashboardLinks from "./DashboardLinks";
import SidebarFooter from "./SidebarFooter";

const Sidebar = ({closeSidebar}: {closeSidebar?: () => void}) => {
  return (
    <aside className="md:w-[272px] bg-white h-full border-r border-[#000000]/20">
        <div className="w-full h-full flex flex-col justify-between px-5 pt-6">
          <div className="py-2 px-4 mb-6 max-md:hidden">
            <Logo className="w-full" />
          </div>
          <h1 className="md:hidden text-xl text-[#667085] font-medium text-center mt-4 mb-14">Menu</h1>

          <DashboardLinks closeSidebar={closeSidebar} />

          <SidebarFooter />
        </div>
    </aside>
  )
}

export default Sidebar;