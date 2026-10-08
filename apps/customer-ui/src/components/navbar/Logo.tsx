import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

import SiteLogo from "../../assets/main-pages/logo.png"

const Logo = ({className, imgClassName}: {className?: string, imgClassName?: string}) => {
  return (
    <Link className={cn(className)} to={"/"} >
      <img className={cn("object-contain w-auto h-10", imgClassName)} src={SiteLogo} alt="TwiPay" />
    </Link>
  )
}

export default Logo