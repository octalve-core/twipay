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
          <button disabled={disabled} onClick={action} className={cn(!icon && "flex items-center gap-2 text-[#667185] cursor-pointer hover:opacity-65 transition font-medium disabled:pointer-events-none disabled:opacity-50", className)}>
            {
              icon ? <img src={ArrowLeft} /> : 
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
          <Link to={href} className={cn(!icon ? "flex items-center gap-2 text-[#667185] cursor-pointer hover:opacity-65 transition font-medium" : "inline-block", className)}>
            {
              icon ? <img src={ArrowLeft} /> : 
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