import { Link } from "react-router-dom";

import Hero_Image_desktop from "../../../assets/main-pages/hero_image.png"
import Hero_Image_mobile from "../../../assets/main-pages/hero_image_mobile.png"
import Partnerships from "./Partnerships"

const Hero = () => {
  return (
    <section className="bg-[#F5F7FF]">
        <div className="max-sm:container pt-10 md:pt-24 text-center">
            <p className="bg-[#edf0fd] rounded-2xl py-2 px-4 text-[#101101] font-medium text-lg w-fit mx-auto">
                Welcome to TwiPay
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-[#112929] mt-12 md:mt-6 max-w-[580px] mx-auto max-sm:px-8">Everyday payments, made simpler</h1>
            <p className="text-[#475467] text-xl mt-2.5 md:mt-4 max-w-[682px] mx-auto max-sm:px-8">One place to manage your account, explore everyday services and stay on top of your transactions.</p>
            <div className="flex items-center gap-2.5 md:gap-4 w-full justify-center mt-[53px] md:mt-10">
              <Link to="/auth/signup" className="bg-[#112929] text-white rounded-lg px-5 md:px-7 py-3 font-medium hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#112929]">Create an account</Link>
              <Link to="/auth/login" className="border border-[#112929] text-[#112929] rounded-lg px-5 md:px-7 py-3 font-medium hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#112929]">Log in</Link>
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