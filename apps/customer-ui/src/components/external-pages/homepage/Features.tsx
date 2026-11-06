import { activeMarketingFeatures } from "@/lib/constants"
import { cn } from "@/lib/utils"


const Features = () => {
  return (
    <section>
        <div className="container py-7 md:py-24 mb-5">
            <div className="text-center max-w-[234px] md:max-w-[768px] mx-auto">
                <h2 className="font-medium text-4xl mb-5 text-[#112929]">Our unique features</h2>
                <p className="text-[#475467] md:text-xl">Simple digital payments, built around your everyday needs</p>
            </div>
            <div className="mt-10 md:mt-16 flex flex-col gap-16">
                {
                    activeMarketingFeatures.map(({id, title, description, image}) => (
                        <article className={cn("flex flex-col md:flex-row items-center max-md:w-[292px] md:h-[480px] max-md:mx-auto", id%2===0 && "md:flex-row-reverse")} key={id}>
                            <div className="w-full h-[245px] md:h-full">
                                <img alt="" className="w-[572px] h-full" src={image} />
                            </div>
                            <div className={cn("w-full h-full grid place-items-center max-md:mt-7", id%2 === 0 ? "md:pr-24" : "md:pl-24")}>
                                <div className="max-w-[500px] mx-auto">                                 
                                    <h3 className="text-[#112929] mb-2 md:mb-6 font-medium text-[28px] md:text-5xl">{title}</h3>
                                    <p className="text-sm md:text-lg text-[#475467]">{description}</p>
                                </div>
                            </div>
                        </article>
                    ))
                }
            </div>
        </div>
    </section>
  )
}

export default Features