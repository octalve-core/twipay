import Mobile_app_store_Apple from "../../../assets/main-pages/Mobile app store badge Apple.png" 
import Mobile_app_store_Google from "../../../assets/main-pages/Mobile app store badge Google.png" 

import Hero_Image_desktop from "../../../assets/main-pages/hero_image.png"
import Hero_Image_mobile from "../../../assets/main-pages/hero_image_mobile.png"
import Partnerships from "./Partnerships"

const Hero = () => {
  return (
    <section className="bg-[#F5F7FF]">
        <div className="max-sm:container pt-10 md:pt-24 text-center">
            <p className="bg-[#edf0fd] rounded-2xl py-2 px-4 text-[#101101] font-medium text-lg w-fit mx-auto">
                Our MVP is live now! 🥳 
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-[#112929] mt-12 md:mt-6 max-w-[580px] mx-auto max-sm:px-8">Your number 1 VTU app 
            for all bill payments</h1>
            <p className="text-[#475467] text-xl mt-2.5 md:mt-4 max-w-[682px] mx-auto max-sm:px-8">Enjoy amazing bill payment experiences that create more happy in the world.</p>
            <div className="flex items-center gap-2.5 md:gap-4 w-full justify-center mt-[53px] md:mt-10">
              <button className="cursor-pointer">
                <img className="w-[120px] h-[40px] md:w-[193px] md:h-[57px]" src={Mobile_app_store_Apple} />
              </button>
              <button className="cursor-pointer">
                <img className="w-[120px] h-[40px] md:w-[193px] md:h-[57px]" src={Mobile_app_store_Google} />
              </button>
            </div>

            <div className="mt-[66px] md:mt-[91px] relative">
                 {/* Rotated background layers */}
                <div className="h-[130px] flex flex-col -rotate-[5deg] absolute top-1/2 -translate-y-1/2 inset-0 z-0">
                    <div className="h-full bg-[#CDD5FF4D] w-full" />
                    <div className="h-full bg-[#CDD5FF] w-full" />
                    <div className="h-full bg-[#112929] w-full" />
                </div>
                  {/* Hero Image */}
                <div className="container relative z-10">
                    <img className="object-cover h-auto mx-auto hidden md:block" src={Hero_Image_desktop} alt="iPhone 15 Pro mockup with credit card in hand" />
                    <img className="object-cover h-[207px] w-[90vw] rounded-md mx-auto md:hidden" src={Hero_Image_mobile} alt="iPhone 15 Pro mockup with credit card in hand" />
                </div>
            </div>
            <Partnerships />
        </div>
    </section>
  )
}

export default Hero