import { activeQuickActions } from "@/lib/constants"
import { Link } from "react-router-dom"
import {motion} from "framer-motion"

const QuickActions = () => {
  return (
    <section className="mt-10 md:mt-[22px] md:p-2.5 rounded-xl md:bg-white">
         <h2 className="text-[#667085] md:text-[#101928] text-sm md:text-lg font-medium">Quick Actions</h2>
         <div className="flex items-center justify-between mt-3.5 md:mt-[30px] mb-10 md:mb-[18px] md:mx-7 md:py-4 md:px-[29px]">
            {
                activeQuickActions.map(({id, href, label, icon: Icon}, i) => (
                  <motion.div key={id}
                    initial={{opacity: 0, y: 20}}
                    whileInView={{opacity: 100, y: 0}}
                    transition={{delay: i*0.05, duration: .5 }}
                    viewport={{once: true}}
                  >
                    <Link to={href} className="flex flex-col items-center gap-2 rounded-md group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#112929]">
                        <div className="size-[59px] md:size-12 bg-[#FFFFFF] md:bg-[#F9FAFB] max-md:border max-md:border-[#AAAAAA]/20 text-[#112929] rounded-md md:rounded-full grid place-items-center group-hover:bg-[#112929] group-hover:text-white transition duration-500"><Icon className="size-5" /></div>
                        <p className="text-[#464E60] md:text-[#112929] text-xs md:font-medium text-center max-md:max-w-1/2">{label}</p>
                    </Link>
                  </motion.div>
                ))
            }
         </div>
    </section>
  )
}

export default QuickActions