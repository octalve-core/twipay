import DesktopNav from "./DesktopNav"
import MobileNav from "./MobileNav"

const Navbar = () => {
  return (
    <nav className="w-screen fixed top-0 left-0 bg-white h-[92px] md:h-[105px] max-md:border-b max-md:border-[#1129291A] z-[100]">
      <DesktopNav />
      <MobileNav />
    </nav>
  )
}

export default Navbar