import { Link } from "react-router-dom";

import Info from "@/assets/dashboard/info.svg";
import Plus from "@/assets/dashboard/plus-circle.svg";
import Divide from "@/assets/dashboard/divide-circle.svg";
import BlockCard from "./BlockCard";

const ActionButtons = () => {
  return (
    <div className="mt-4 md:mt-6 w-full max-w-[454px] flex items-center justify-between">
        <Link className="flex flex-col items-center" to="/dashboard/virtual-card/details">
            <div className="bg-white size-[64px] grid place-items-center rounded-md md:rounded-lg border border-transparent hover:border-[#464E60] transition">
                <img alt="" className="size-5 object-cover" src={Info} />
            </div>
            <span className="text-[#464E60] text-center text-xs">Card<br /> Details</span>
        </Link>
        <Link className="flex flex-col items-center" to="/dashboard/virtual-card/fund">
            <div className="bg-white size-[64px] grid place-items-center rounded-md md:rounded-lg border border-transparent hover:border-[#464E60] transition">
                <img alt="" className="size-5 object-cover" src={Plus} />
            </div>
            <span className="text-[#464E60] text-center text-xs">Fund<br /> Card</span>
        </Link>
        <Link className="flex flex-col items-center" to="/dashboard/virtual-card/withdraw">
            <div className="bg-white size-[64px] grid place-items-center rounded-md md:rounded-lg border border-transparent hover:border-[#464E60] transition">
                <img alt="" className="size-5 object-cover" src={Divide} />
            </div>
            <span className="text-[#464E60] text-center text-xs">Withdraw<br /> Funds</span>
        </Link>
        <BlockCard />
    </div>
  )
}

export default ActionButtons