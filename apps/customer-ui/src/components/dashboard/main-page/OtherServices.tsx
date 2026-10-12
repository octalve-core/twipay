import { activeAppServices, activeOtherServices } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Link } from "react-router-dom"
import MobileOtherServicesDrawer from "./MobileOtherServicesDrawer"
import {motion} from "framer-motion"


const OtherServices = () => {

  return (
    <section className="mt-5">
        {/* Desktop screens */}
        <h2 className="text-[#667085] md:text-[#101928] max-md:text-sm mb-4 font-medium">Other services</h2>
        <div className="max-md:hidden flex items-center h-[88px] md:h-[170px] w-full gap-2 md:gap-4">
            {
                activeOtherServices.map(({id, label, href, icon, bgColor}, i) => (
                    <Link className="h-full w-full" key={id} to={href}>
                        <motion.div
                            initial={{opacity: 0, y: 50}}
                            whileInView={{opacity: 100, y: 0}}
                            transition={{delay: i*0.08, duration: .5 }}
                            viewport={{once: true}}
                            className="h-full w-full flex flex-col justify-between rounded-md md:rounded-xl p-2 md:p-5 hover:scale-x-110 transition duration-500"
                            style={{
                                background: bgColor
                            }}
                        >
                            <img className={cn("object-cover", id===4 ? "w-full md:w-24 h-4 md:h-6" : "size-3.5 md:size-8")} src={icon} alt={label} />
                            <p className="md:w-2/3 text-[#1D2739] font-medium text-xs md:text-sm md:leading-5" >{label}</p>
                        </motion.div>
                    </Link>
                ))
            }
        </div>

            {/* Mobile screens */}
        <div className="grid grid-cols-4 gap-[30px] mt-4 md:hidden">
            {
                activeAppServices.slice(0, 7).map(({id, label, icon, href}, i) => (
                    <motion.div
                        initial={{opacity: 0, y: 20}}
                        whileInView={{opacity: 100, y: 0}}
                        transition={{delay: i*0.05, duration: .5 }}
                        viewport={{once: true}}
                        key={id} 
                        className="flex flex-col items-center group"
                    >
                        <Link to={href} className="grid place-items-center border-1 border-[#AAAAAA]/20 group-hover:border-[#112929] bg-white size-[59px] md:size-16 rounded-md cursor-pointer transition">
                            <img alt={label} src={icon} className="size-7 md:size-[30px] object-cover" />
                        </Link>
                        <p className="text-[#464E60] text-xs md:text-base">{label}</p>
                    </motion.div>
                ))
            }
            <MobileOtherServicesDrawer />
        </div>
    </section>
  )
}

export default OtherServices