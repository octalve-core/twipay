import { cn } from "@/lib/utils";
import BeatLoader from "react-spinners/BeatLoader";

const Loader = ({className}: {className?: string}) => {
    return (
        <div className={cn('w-screen h-screen flex items-center justify-center', className)}>
            <BeatLoader  
                color={"#112929"}
            />
        </div>
    )
}

export default Loader