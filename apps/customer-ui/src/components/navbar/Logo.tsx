import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { brand } from "@/config/brand"

// Shows the brand's picture logo if one is set in config/brand.ts, otherwise its name as a wordmark.
export const BrandMark = ({imgClassName}: {imgClassName?: string}) =>
  brand.logoImage
    ? <img className={cn("object-contain w-auto h-10", imgClassName)} src={brand.logoImage} alt={brand.name} />
    : <span className={cn("inline-flex items-center h-10 text-2xl font-extrabold tracking-tight text-[#112929]", imgClassName)}>{brand.name}</span>

const Logo = ({className, imgClassName}: {className?: string, imgClassName?: string}) => {
  return (
    <Link className={cn(className)} to={"/"} aria-label={brand.name}>
      <BrandMark imgClassName={imgClassName} />
    </Link>
  )
}

export default Logo
