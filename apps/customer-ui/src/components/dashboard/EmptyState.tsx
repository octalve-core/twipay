import EmptyStateImg from "@/assets/dashboard/empty-state.png"
import { cn } from "@/lib/utils";
import BackButton from "../Authentication/BackButton";

const EmptyState = ({text, className, showBackBtn=false}:{text: string; className?: string; showBackBtn?: boolean}) => {
  return (
    <div className={cn("w-full h-full grid place-items-center", className)}>
        <div className="flex flex-col gap-4 justify-center items-center w-[170px]">
            <img src={EmptyStateImg} className="size-16 object-cover" />
            <p className="text-sm font-medium text-[#667085] text-center">{text}</p>
            {showBackBtn && <BackButton className="mt-2 " action={() => window.history.back()} />}
        </div>
    </div>
  )
}

export default EmptyState