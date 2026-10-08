import { cn } from "@/lib/utils";
import { BsHourglassTop } from "react-icons/bs";
import { MdBlockFlipped } from "react-icons/md";
import BackButton from "../Authentication/BackButton";
import { useNavigate } from "react-router-dom";

const ServiceStatusMsg = ({ status, statusMsg }: { status: string | undefined; statusMsg: string }) => {
    const navigate = useNavigate();
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4">
        {status === "coming-soon" && <BsHourglassTop size={50} className="mb-2 text-[#112929] opacity-60" />}
        {status === "deactivated" && <MdBlockFlipped size={50} className="mb-2 text-red-500 opacity-60" />}
        <p className={cn("text-center text-[#112929]", status === "deactivated" && "text-red-500")}>{statusMsg}</p>
        <BackButton className="mt-8" action={() =>navigate(-1)} />
    </div>
  )
}

export default ServiceStatusMsg