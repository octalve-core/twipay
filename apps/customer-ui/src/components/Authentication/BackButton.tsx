import { cn } from '@/lib/utils';
import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom';

type TBackButton = {
    action?: () => void,
    href?: string;
    className?: string;
    icon?: boolean | null;
    disabled?: boolean;
}

import ArrowLeft from "@/assets/dashboard/arrow_left.svg";

const BackButton = ({action, href, className, icon, disabled}: TBackButton) => {
  return (
    <>

      {
        action && (
          <button type="button" disabled={disabled} aria-label={icon ? "Back" : undefined} onClick={action} className={cn(!icon && "flex items-center gap-2 text-[#667185] cursor-pointer hover:opacity-65 transition font-medium disabled:pointer-events-none disabled:opacity-50", className)}>
            {
              icon ? <img src={ArrowLeft} alt="" /> :
                <>
                  <ChevronLeft className="size-5" />
                  <span>Back</span>
                </>
            }
          </button>
        )
      }
      {
        href && (
          <Link to={href} aria-label={icon ? "Back" : undefined} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} onClick={disabled ? (event) => event.preventDefault() : undefined} className={cn(disabled && "opacity-50 pointer-events-none cursor-not-allowed", !icon ? "flex items-center gap-2 text-[#667185] cursor-pointer hover:opacity-65 transition font-medium" : "inline-block", className)}>
            {
              icon ? <img src={ArrowLeft} alt="" /> :
                <>
                  <ChevronLeft className="size-5" />
                  <span>Back</span>
                </>
            }
          </Link>
        )
      }
    </>
  )
}

export default BackButton