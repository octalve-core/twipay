import { activeAppServices } from "@/lib/constants"
import { Link } from "react-router-dom"
import {motion} from "framer-motion"

const ServicesList = () => {
  return (
    <section className="mt-10 md:mt-[22px] md:p-2.5 rounded-xl md:bg-white">
        <h2 className="text-[#667085] md:text-[#101928] text-sm md:text-lg font-medium">Services</h2>
        <div className="flex flex-wrap items-center mt-[30px] mb-[18px] py-4 gap-y-5">
          {
              activeAppServices.slice(0, 8).map(({id, label, icon, href}, i) => (
                  <motion.div 
                    initial={{opacity: 0, y: 20}}
                    whileInView={{opacity: 100, y: 0}}
                    transition={{delay: i*0.05, duration: .5 }}
                    viewport={{once: true}}
                    key={id} 
                    className="w-1/4 flex flex-col gap-1 items-center group">
                      <Link to={href} className="grid place-items-center border-1 border-[#AAAAAA]/20 group-hover:border-[#112929] bg-white size-12 rounded-md cursor-pointer transition">
                          <img alt={label} src={icon} className="size-[24px] object-cover" />
                      </Link>
                      <p className="text-[#464E60] text-sm font-medium">{label}</p>
                  </motion.div>
              ))
            }
        </div>
    </section>
  )
}

export default ServicesList