import Our_Mission_Image from "../../../assets/main-pages/our_mission.png";

const OurMission = () => {
  return (
    <section className="bg-[#F9FAFB]">
      <div className="container py-10 md:py-24 flex flex-col md:flex-row items-center max-md:w-[80vw] max-md:mx-auto">
        <div className="w-full h-[245px] md:h-[480px]">
          <img className="" src={Our_Mission_Image} />
        </div>
        <div className="w-full h-full grid place-items-center max-md:mt-7">
          <div className="max-w-[481px] mx-auto">
            <h3 className="text-[#112929] mb-2 md:mb-6 font-medium text-[28px] md:text-5xl">
              Our mission
            </h3>
            <p className="text-sm md:text-lg text-[#475467]">
              Our mission is to empower our users with the ability to manage
              their mobile and digital needs effortlessly. We aim to bridge the
              gap between technology and convenience, providing a platform
              that&apos;s not only user-friendly but also reliable and secure.
              With TwiPay, you're in control, whether you&apos;re at home, at
              work, or on the go.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OurMission;
