import AboutPage from "@/components/external-pages/aboutpage/AboutPage"
import OurMission from "@/components/external-pages/aboutpage/OurMission"
import MobileAppLinks from "@/components/external-pages/homepage/MobileAppLinks"
import Partnerships from "@/components/external-pages/homepage/Partnerships"
import WhyUse from "@/components/external-pages/homepage/WhyUse"

const About = () => {
  return (
    <>
      <AboutPage />
      <OurMission />
      <Partnerships />
      <WhyUse className="bg-[#F9FAFB]" />
      <MobileAppLinks />
    </>
  )
}

export default About