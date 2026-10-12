import Logo from "./Logo"
import NavLinks from "./NavLinks"
import AuthButtons from "../Authentication/AuthButtons"

const DesktopNav = () => {
  return (
    <div className="container hidden md:flex justify-between items-center h-full">
          <div className="flex justify-between items-center gap-10 w-full">
            <Logo />
            <NavLinks />
          <AuthButtons />
          </div>
      </div>
  )
}

export default DesktopNav