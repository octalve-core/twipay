import BackButton from "@/components/Authentication/BackButton";
import { activeAppServices } from "@/lib/constants";
import { Link } from "react-router-dom";
import {motion} from "framer-motion"

const ServicesSection = () => {
  return (
    <section className="w-[422px] md:text-center">
        <BackButton icon href="/dashboard" className="mb-8 mt-2 md:hidden" />
        <motion.h1 initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0, transition: {duration: .5}}} className="text-[#112929] text-2xl font-medium mb-2">Services</motion.h1>
        <motion.h2 initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0, transition: {duration: .5, delay: .2}}} className="text-[#717171]">Select a service you are trying to use</motion.h2>

        <div className="grid grid-cols-4 gap-[30px] md:gap-x-14 md:gap-y-7 mt-[30px] md:mt-12">
            {
                activeAppServices.map(({id, label, icon, href}, i) => (
                    <motion.div
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 100, y: 0}}
                        transition={{delay: i*0.05, duration: .3 }}
                        key={id} className="flex flex-col items-center group">
                        <Link to={href} className="grid place-items-center border-1 border-[#AAAAAA]/20 group-hover:border-[#112929] bg-white size-[59px] md:size-16 rounded-md cursor-pointer transition">
                            <img alt={label} src={icon} className="size-7 md:size-[30px] object-cover" />
                        </Link>
                        <p className="text-[#464E60] text-xs md:text-base">{label}</p>
                    </motion.div>
                ))
            }
        </div>
    </section>
  )
}

export default ServicesSection;